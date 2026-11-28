import { afterEach, describe, expect, it } from 'vitest'
import { currentStep, totpAt } from '../../src/features/auth/data/totp.server'
import { outbox } from '#/server/email'
import { serverEnv } from '#/server/env'
import {
  client,
  lastDeleteCode,
  lastToken,
  otherCode,
  registered,
} from './helpers'

interface Security {
  emailVerified: boolean
  pendingEmail: string | null
  twoFactor: boolean
  recoveryCodesLeft: number
  google: boolean
  hasPassword: boolean
}
interface Session {
  accessToken: string
  user: { email: string; role: string }
}
const PASSWORD = 'correct horse 42'

const mailsTo = (to: string) => outbox.filter((email) => email.to === to)

afterEach(() => serverEnv.adminEmails.clear())

describe('email confirmation', () => {
  it('Should send a link on sign-up and confirm the address with it', async () => {
    const { apiClient, email } = await registered('en', { verify: false })
    expect(mailsTo(email).at(-1)?.subject).toBe(
      'Confirm your email for Timeblame',
    )
    expect(
      (await apiClient.get<Security>('/account/security')).body.emailVerified,
    ).toBe(false)
    // Bez potwierdzonego adresu nie da się kupić planu.
    const checkout = await apiClient.post<{ code: string }>(
      '/billing/checkout',
      {
        plan: 'pro',
      },
    )
    expect([403, 503]).toContain(checkout.status)

    const confirmed = await apiClient.post<{ kind: string }>(
      '/auth/email/confirm',
      {
        token: lastToken(email),
      },
    )
    expect(confirmed.body.kind).toBe('verified')
    expect(
      (await apiClient.get<Security>('/account/security')).body.emailVerified,
    ).toBe(true)
    expect((await apiClient.post('/account/email/verify')).status).toBe(409)
    // Link działa tylko raz.
    expect(
      (await apiClient.post('/auth/email/confirm', { token: lastToken(email) }))
        .status,
    ).toBe(400)
  })
})

describe('changing the email address', () => {
  it('Should need the password and a click on the link sent to the new address', async () => {
    const { apiClient, email, username } = await registered()
    const next = `new-${email}`
    expect(
      (
        await apiClient.post('/account/email', {
          email: next,
          password: 'nope',
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await apiClient.post('/account/email', {
          email: next,
          password: PASSWORD,
        })
      ).status,
    ).toBe(204)
    // Do potwierdzenia adres się nie zmienia, a stary dostaje ostrzeżenie.
    const pending = await apiClient.get<Security>('/account/security')
    expect(pending.body.pendingEmail).toBe(next)
    expect(
      (await apiClient.get<{ email: string }>('/account')).body.email,
    ).toBe(email)
    expect(mailsTo(email).at(-1)?.subject).toBe(
      'Your Timeblame email is about to change',
    )

    const done = await client().post<{ kind: string }>('/auth/email/confirm', {
      token: lastToken(next),
    })
    expect(done.body.kind).toBe('changed')
    expect(
      (await apiClient.get<{ email: string }>('/account')).body.email,
    ).toBe(next)
    expect(mailsTo(email).at(-1)?.subject).toBe(
      'Your Timeblame email was changed',
    )
    const relogin = await client().post<Session>('/auth/login', {
      login: next,
      password: PASSWORD,
    })
    expect(relogin.body.user.email).toBe(next)
    expect(username).toBeTruthy()
  })

  it('Should not let an email change take over the owner’s admin role', async () => {
    const { apiClient } = await registered()
    const ownerEmail = `owner-${Date.now()}@example.com`
    serverEnv.adminEmails.add(ownerEmail)
    await apiClient.post('/account/email', {
      email: ownerEmail,
      password: PASSWORD,
    })
    // Bez dostępu do skrzynki właściciela adres się nie zmienia i roli admina nie ma.
    const refreshed = await apiClient.post<Session>('/auth/refresh')
    expect(refreshed.body.user.role).toBe('client')
    expect(refreshed.body.user.email).not.toBe(ownerEmail)
    expect((await apiClient.get('/admin/stats')).status).toBe(403)
  })
})

describe('two-step login', () => {
  async function withTwoFactor() {
    const account = await registered()
    const setup = await account.apiClient.post<{
      secret: string
      otpauthUrl: string
    }>('/account/2fa/setup')
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Timeblame/)
    const enabled = await account.apiClient.post<{
      recoveryCodes: Array<string>
    }>('/account/2fa/enable', {
      secret: setup.body.secret,
      code: totpAt(setup.body.secret, currentStep()),
      password: PASSWORD,
    })
    expect(enabled.status).toBe(200)
    expect(enabled.body.recoveryCodes).toHaveLength(10)
    return {
      ...account,
      secret: setup.body.secret,
      codes: enabled.body.recoveryCodes,
    }
  }

  it('Should ask for a code after the password and accept a backup code once', async () => {
    const { username, codes } = await withTwoFactor()
    const apiClient = client()
    const first = await apiClient.post<{
      mfaRequired: boolean
      mfaToken: string
    }>('/auth/login', { login: username, password: PASSWORD })
    expect(first.body.mfaRequired).toBe(true)
    // Sam bilet nie daje dostępu do API.
    expect((await apiClient.get('/account')).status).toBe(401)

    const wrong = await apiClient.post('/auth/login/2fa', {
      mfaToken: first.body.mfaToken,
      code: '000000',
    })
    expect(wrong.status).toBe(400)
    const ok = await apiClient.post<Session>('/auth/login/2fa', {
      mfaToken: first.body.mfaToken,
      code: codes[0],
    })
    expect(ok.status).toBe(200)
    expect((await apiClient.get('/account')).status).toBe(200)

    const again = await client().post<{ mfaToken: string }>('/auth/login', {
      login: username,
      password: PASSWORD,
    })
    const reused = await client().post('/auth/login/2fa', {
      mfaToken: again.body.mfaToken,
      code: codes[0],
    })
    expect(reused.status).toBe(400)
  })

  it('Should accept the app code and turn off with it', async () => {
    const { apiClient, username, secret, codes } = await withTwoFactor()
    const first = await client().post<{ mfaToken: string }>('/auth/login', {
      login: username,
      password: PASSWORD,
    })
    // Krok po tym użytym przy włączaniu (ten sam kod nie działa dwa razy).
    const login = await client().post('/auth/login/2fa', {
      mfaToken: first.body.mfaToken,
      code: totpAt(secret, currentStep() + 1),
    })
    expect(login.status).toBe(200)

    const security = await apiClient.get<Security>('/account/security')
    expect(security.body).toMatchObject({
      twoFactor: true,
      recoveryCodesLeft: 10,
    })
    expect(
      (
        await apiClient.post('/account/2fa/disable', {
          password: PASSWORD,
          code: '123456',
        })
      ).status,
    ).toBe(400)
    // Kod z aplikacji z tego okna został już użyty przy logowaniu: wyłączamy kodem zapasowym.
    const off = await apiClient.post('/account/2fa/disable', {
      password: PASSWORD,
      code: codes[1],
    })
    expect(off.status).toBe(204)
    expect(
      (await apiClient.get<Security>('/account/security')).body.twoFactor,
    ).toBe(false)
  })
})

describe('devices', () => {
  it('Should list signed-in devices and sign out the others', async () => {
    const { apiClient, username } = await registered()
    const phone = client()
    await phone.post('/auth/login', { login: username, password: PASSWORD })

    const list =
      await apiClient.get<Array<{ id: string; current: boolean }>>(
        '/account/sessions',
      )
    expect(list.body).toHaveLength(2)
    expect(list.body[0]!.current).toBe(true)

    expect(
      (await apiClient.post('/account/sessions/revoke-others')).status,
    ).toBe(204)
    expect(
      (await apiClient.get<Array<unknown>>('/account/sessions')).body,
    ).toHaveLength(1)
    expect((await phone.post('/auth/refresh')).status).toBe(401)
  })
})

describe('deleting the account', () => {
  it('Should send a 6-digit code to the account email and delete the account with it', async () => {
    const { apiClient, email, username } = await registered()
    expect((await apiClient.post('/account/delete-code')).status).toBe(204)
    expect(mailsTo(email).at(-1)?.subject).toBe(
      'Your code to delete your Timeblame account',
    )
    expect(
      (await apiClient.del('/account', { code: lastDeleteCode(email) })).status,
    ).toBe(204)
    const login = await client().post('/auth/login', {
      login: username,
      password: PASSWORD,
    })
    expect(login.status).toBe(401)
  })

  it('Should reject a wrong code and keep the account', async () => {
    const { apiClient, email } = await registered()
    await apiClient.post('/account/delete-code')
    const response = await apiClient.del<{ code: string }>('/account', {
      code: otherCode(lastDeleteCode(email)),
    })
    expect([response.status, response.body.code]).toEqual([
      400,
      'auth.invalid_delete_code',
    ])
    expect((await apiClient.get('/account')).status).toBe(200)
  })

  it('Should accept only the newest code', async () => {
    const { apiClient, email } = await registered()
    await apiClient.post('/account/delete-code')
    const first = lastDeleteCode(email)
    await apiClient.post('/account/delete-code')
    const response = await apiClient.del<{ code: string }>('/account', {
      code: first,
    })
    // Szansa, że nowy kod jest taki sam jak stary, to 1 na milion.
    expect(response.status).toBe(400)
  })

  it.each(['12345', 'abcdef', '1234567', ''])(
    'Should reject "%s" as a delete code',
    async (code) => {
      const { apiClient } = await registered()
      await apiClient.post('/account/delete-code')
      expect((await apiClient.del('/account', { code })).status).toBe(400)
    },
  )

  it('Should not send a delete code to a demo account', async () => {
    const apiClient = client()
    await apiClient.post('/auth/demo', {})
    expect((await apiClient.post('/account/delete-code')).status).toBe(403)
  })
})
