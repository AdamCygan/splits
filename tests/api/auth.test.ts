import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { sha256 } from '#/server/auth/tokens'
import { db } from '#/server/db/client'
import { refreshTokens } from '#/server/db/schema'
import { client, inSequence, numbered, registered, sample } from './helpers'

interface Session {
  accessToken: string
  user: { id: string }
}

describe('auth', () => {
  it('Should rotate the refresh token and detect reuse of an old one', async () => {
    const { c } = await registered()
    const first = c.cookies.get('refresh_token')!
    expect(first).toBeTruthy()

    const refreshed = await c.post<Session>('/auth/refresh')
    expect(refreshed.status).toBe(200)
    const second = c.cookies.get('refresh_token')!
    expect(second).not.toBe(first)

    // Tuż po wymianie stary token jeszcze działa (druga karta, zgubiona odpowiedź).
    const tab = client()
    tab.cookies.set('refresh_token', first)
    expect((await tab.post('/auth/refresh')).status).toBe(200)

    // Po oknie tolerancji użycie starego tokenu = kradzież: cała rodzina sesji przestaje działać.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.tokenHash, sha256(first)))
    const thief = client()
    thief.cookies.set('refresh_token', first)
    expect((await thief.post('/auth/refresh')).status).toBe(401)
    expect((await c.post('/auth/refresh')).status).toBe(401)
    expect((await tab.post('/auth/refresh')).status).toBe(401)
  })

  it('Should set the refresh cookie as HttpOnly and scoped to the auth API', async () => {
    const c = client()
    const res = await c.post('/auth/register', {
      username: `cookie${Date.now().toString(36)}`,
      email: `cookie${Date.now().toString(36)}@example.com`,
      password: 'correct horse 42',
      locale: 'en',
    })
    const header = res.headers.getSetCookie().join('\n')
    expect(header).toMatch(/refresh_token=.*HttpOnly/)
    expect(header).toMatch(/Path=\/api\/v1\/auth/)
    expect(header).toMatch(/SameSite=Lax/)
  })

  it('Should log out and block the old session', async () => {
    const { c } = await registered()
    const token = c.cookies.get('refresh_token')!
    expect((await c.post('/auth/logout')).status).toBe(204)
    const again = client()
    again.cookies.set('refresh_token', token)
    expect((await again.post('/auth/refresh')).status).toBe(401)
  })

  it('Should reject cookie requests from other sites (CSRF)', async () => {
    const { c } = await registered()
    const res = await c.post('/auth/refresh', undefined, {
      Origin: 'https://evil.example',
    })
    expect(res.status).toBe(403)
  })

  it('Should require a valid access token for app data', async () => {
    const c = client()
    expect((await c.get('/task-types')).status).toBe(401)
    c.setToken('not-a-jwt')
    const res = await c.get<{ code: string }>('/task-types')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('auth.no_session')
  })

  it('Should validate sign-up input and answer in the user’s language', async () => {
    const c = client()
    const res = await c.post<{
      code: string
      detail: string
      errors: Record<string, unknown>
    }>(
      '/auth/register',
      { username: 'x', email: 'nope', password: 'short', locale: 'pl' },
      { 'Accept-Language': 'pl-PL,pl;q=0.9' },
    )
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.invalid')
    expect(res.body.detail).toBe('Popraw zaznaczone pola.')
    expect(Object.keys(res.body.errors)).toEqual(['username'])
  })

  it('Should reset a password with a one-time link', async () => {
    const { c, email } = await registered()
    const logs: Array<string> = []
    const original = console.info
    console.info = (msg: string) => logs.push(msg)
    try {
      expect((await c.post('/auth/forgot-password', { email })).status).toBe(
        204,
      )
      // Nieznany adres: ta sama odpowiedź, bez e-maila (nie zdradzamy, kto ma konto).
      expect(
        (await c.post('/auth/forgot-password', { email: 'nobody@example.com' }))
          .status,
      ).toBe(204)
    } finally {
      console.info = original
    }
    expect(logs).toHaveLength(1)
    const token = /reset-password\?token=([\w-]+)/.exec(logs[0]!)![1]!

    const reset = await client().post('/auth/reset-password', {
      token,
      password: 'brand new pass 7',
    })
    expect(reset.status).toBe(204)
    const reused = await client().post<{ code: string }>(
      '/auth/reset-password',
      {
        token,
        password: 'brand new pass 8',
      },
    )
    expect(reused.body.code).toBe('auth.reset_invalid')

    // Stare sesje wygasły, nowe hasło działa.
    expect((await c.post('/auth/refresh')).status).toBe(401)
    const login = await client().post('/auth/login', {
      login: email,
      password: 'brand new pass 7',
    })
    expect(login.status).toBe(200)
  })

  it('Should lock the account for a while after many wrong passwords', async () => {
    const { username } = await registered()
    const c = client()
    const attempts = await inSequence(numbered(11), (i) =>
      c.post(
        '/auth/login',
        { login: username, password: `wrong ${i}` },
        { 'X-Forwarded-For': `10.0.0.${i}` },
      ),
    )
    expect(attempts.at(-1)?.status).toBe(429)
  })

  it('Should create a sample account for end-to-end tests', async () => {
    const c = await sample()
    const entries = await c.get<Array<{ title: string }>>(
      '/time-entries?from=2000-01-01&to=2100-01-01',
    )
    expect(entries.body.length).toBeGreaterThan(10)
    expect((await c.get<Array<unknown>>('/projects')).body).toHaveLength(2)
  })

  it('Should report health and app info', async () => {
    const c = client()
    expect((await c.get<{ status: string }>('/health')).body.status).toBe('ok')
    expect((await c.get<{ name: string }>('/meta')).body.name).toBe(
      'Timeblame',
    )
    expect((await c.get('/nope')).status).toBe(404)
  })
})
