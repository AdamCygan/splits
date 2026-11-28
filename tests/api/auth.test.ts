import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { sha256 } from '../../src/features/auth/data/tokens.server'
import { database } from '#/server/db/client'
import { refreshTokens } from '#/server/db/schema'
import { client, inSequence, numbered, registered, sample } from './helpers'

interface Session {
  accessToken: string
  user: { id: string }
}

describe('auth', () => {
  it('Should rotate the refresh token and detect reuse of an old one', async () => {
    const { apiClient } = await registered()
    const first = apiClient.cookies.get('refresh_token')!
    expect(first).toBeTruthy()

    const refreshed = await apiClient.post<Session>('/auth/refresh')
    expect(refreshed.status).toBe(200)
    const second = apiClient.cookies.get('refresh_token')!
    expect(second).not.toBe(first)

    // Tuż po wymianie stary token jeszcze działa (druga karta, zgubiona odpowiedź).
    const tab = client()
    tab.cookies.set('refresh_token', first)
    expect((await tab.post('/auth/refresh')).status).toBe(200)

    // Po oknie tolerancji użycie starego tokenu = kradzież: cała rodzina sesji przestaje działać.
    await database
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.tokenHash, sha256(first)))
    const thief = client()
    thief.cookies.set('refresh_token', first)
    expect((await thief.post('/auth/refresh')).status).toBe(401)
    expect((await apiClient.post('/auth/refresh')).status).toBe(401)
    expect((await tab.post('/auth/refresh')).status).toBe(401)
  })

  it('Should set the refresh cookie as HttpOnly and scoped to the auth API', async () => {
    const apiClient = client()
    const response = await apiClient.post('/auth/register', {
      username: `cookie${Date.now().toString(36)}`,
      email: `cookie${Date.now().toString(36)}@example.com`,
      password: 'correct horse 42',
      locale: 'en',
    })
    const header = response.headers.getSetCookie().join('\n')
    expect(header).toMatch(/refresh_token=.*HttpOnly/)
    expect(header).toMatch(/Path=\/api\/v1\/auth/)
    expect(header).toMatch(/SameSite=Lax/)
  })

  it('Should log out and block the old session', async () => {
    const { apiClient } = await registered()
    const token = apiClient.cookies.get('refresh_token')!
    expect((await apiClient.post('/auth/logout')).status).toBe(204)
    const again = client()
    again.cookies.set('refresh_token', token)
    expect((await again.post('/auth/refresh')).status).toBe(401)
  })

  it('Should reject cookie requests from other sites (CSRF)', async () => {
    const { apiClient } = await registered()
    const response = await apiClient.post('/auth/refresh', undefined, {
      Origin: 'https://evil.example',
    })
    expect(response.status).toBe(403)
  })

  it('Should require a valid access token for app data', async () => {
    const apiClient = client()
    expect((await apiClient.get('/task-types')).status).toBe(401)
    apiClient.setToken('not-a-jwt')
    const response = await apiClient.get<{ code: string }>('/task-types')
    expect(response.status).toBe(401)
    expect(response.body.code).toBe('auth.no_session')
  })

  it('Should validate sign-up input and answer in the user’s language', async () => {
    const apiClient = client()
    const response = await apiClient.post<{
      code: string
      detail: string
      errors: Record<string, unknown>
    }>(
      '/auth/register',
      { username: 'x', email: 'nope', password: 'short', locale: 'pl' },
      { 'Accept-Language': 'pl-PL,pl;q=0.9' },
    )
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('validation.invalid')
    expect(response.body.detail).toBe('Popraw zaznaczone pola.')
    expect(Object.keys(response.body.errors)).toEqual(['username'])
  })

  it('Should reset a password with a one-time link', async () => {
    const { apiClient, email } = await registered()
    const logs: Array<string> = []
    const original = console.info
    console.info = (message: string) => logs.push(message)
    try {
      expect(
        (await apiClient.post('/auth/forgot-password', { email })).status,
      ).toBe(204)
      // Nieznany adres: ta sama odpowiedź, bez e-maila (nie zdradzamy, kto ma konto).
      expect(
        (
          await apiClient.post('/auth/forgot-password', {
            email: 'nobody@example.com',
          })
        ).status,
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
    expect((await apiClient.post('/auth/refresh')).status).toBe(401)
    const login = await client().post('/auth/login', {
      login: email,
      password: 'brand new pass 7',
    })
    expect(login.status).toBe(200)
  })

  it('Should lock the account for a while after many wrong passwords', async () => {
    const { username } = await registered()
    const apiClient = client()
    const attempts = await inSequence(numbered(11), (index) =>
      apiClient.post(
        '/auth/login',
        { login: username, password: `wrong ${index}` },
        { 'X-Forwarded-For': `10.0.0.${index}` },
      ),
    )
    expect(attempts.at(-1)?.status).toBe(429)
  })

  it('Should create a sample account for end-to-end tests', async () => {
    const sampleUser = await sample()
    const entries = await sampleUser.get<Array<{ title: string }>>(
      '/time-entries?from=2000-01-01&to=2100-01-01',
    )
    expect(entries.body.length).toBeGreaterThan(10)
    expect(
      (await sampleUser.get<Array<unknown>>('/projects')).body,
    ).toHaveLength(2)
  })

  it('Should report health and app info', async () => {
    const apiClient = client()
    expect(
      (await apiClient.get<{ status: string }>('/health')).body.status,
    ).toBe('ok')
    expect((await apiClient.get<{ name: string }>('/meta')).body.name).toBe(
      'Timeblame',
    )
    expect((await apiClient.get('/nope')).status).toBe(404)
  })
})
