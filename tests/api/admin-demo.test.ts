import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { database } from '#/server/db/client'
import { refreshTokens, users } from '#/server/db/schema'
import { runMaintenance } from '#/server/maintenance'
import { client, registered, registeredAdmin as admin, sample } from './helpers'
import type { ApiClient, ApiResponse } from './helpers'

interface Session {
  accessToken: string
  user: { id: string; isDemo: boolean; plan: string; role: string }
}
interface AdminUser {
  id: string
  email: string
  plan: string
  role: string
  disabledAt: string | null
  entries: number
  isDemo: boolean
}
interface Page {
  items: Array<AdminUser>
  total: number
  page: number
  pageSize: number
}

interface TestAccount {
  username: string
}

const login = (apiClient: ReturnType<typeof client>, account: TestAccount) =>
  apiClient.post<Session>('/auth/login', {
    login: account.username,
    password: 'correct horse 42',
  })

describe('demo account', () => {
  it('Should open a ready workspace without signing up', async () => {
    const apiClient = client()
    const response = await apiClient.post<Session>('/auth/demo', {
      locale: 'pl',
      timezone: 'Europe/Warsaw',
    })
    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({
      isDemo: true,
      plan: 'pro',
      role: 'client',
    })

    const boot = await apiClient.get<{
      user: { isDemo: boolean }
      settings: { locale: string; timezone: string }
      taskTypes: Array<unknown>
      entries: Array<unknown>
      today: string
    }>('/bootstrap')
    expect(boot.status).toBe(200)
    expect(boot.body.settings).toMatchObject({
      locale: 'pl',
      timezone: 'Europe/Warsaw',
    })
    expect(boot.body.taskTypes.length).toBeGreaterThan(3)
    expect(boot.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Dane przykładowe: jest historia do raportów.
    const from = '2020-01-01'
    const range = await apiClient.get<Array<unknown>>(
      `/time-entries?from=${from}&to=${boot.body.today}`,
    )
    expect(range.body.length).toBeGreaterThan(10)
  })

  it.each<
    [string, (apiClient: ApiClient) => Promise<ApiResponse<{ code: string }>>]
  >([
    [
      'buy Pro',
      (apiClient) =>
        apiClient.post<{ code: string }>('/billing/checkout', { plan: 'pro' }),
    ],
    [
      'open the billing portal',
      (apiClient) => apiClient.post<{ code: string }>('/billing/portal'),
    ],
    [
      'change the profile',
      (apiClient) =>
        apiClient.put<{ code: string }>('/account/profile', {
          displayName: 'X',
          email: 'x@example.com',
        }),
    ],
    [
      'change the password',
      (apiClient) =>
        apiClient.post<{ code: string }>('/account/password', {
          currentPassword: '',
          newPassword: 'new password 42',
        }),
    ],
  ])('Should not let a demo account %s', async (_action, request) => {
    const apiClient = client()
    await apiClient.post('/auth/demo', {})
    const response = await request(apiClient)
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('demo.restricted')
  })

  it('Should let a demo account log time as usual', async () => {
    const apiClient = client()
    await apiClient.post('/auth/demo', {})
    const types =
      await apiClient.get<Array<{ id: string; kind: string }>>('/task-types')
    const meeting = types.body.find((taskType) => taskType.kind === 'meeting')!
    const boot = await apiClient.get<{ today: string }>('/bootstrap')
    const created = await apiClient.post('/time-entries', {
      taskTypeId: meeting.id,
      projectId: null,
      title: 'Demo standup',
      link: null,
      storyPoints: null,
      workDate: boot.body.today,
      startTime: null,
      endTime: null,
      durationMinutes: 15,
      note: null,
      running: false,
    })
    expect(created.status).toBe(201)
  })

  it('Should be removed after 24 hours together with its data', async () => {
    const apiClient = client()
    const response = await apiClient.post<Session>('/auth/demo', {})
    const id = response.body.user.id
    expect((await runMaintenance()).demoAccounts).toBe(0)
    await database
      .update(users)
      .set({ createdAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(eq(users.id, id))
    expect((await runMaintenance()).demoAccounts).toBeGreaterThanOrEqual(1)
    expect((await apiClient.get('/account')).status).toBe(401)
  })
})

describe('maintenance', () => {
  it('Should delete expired and long-revoked refresh tokens and keep live ones', async () => {
    const { apiClient } = await registered()
    const me = await apiClient.get<{ id: string }>('/account')
    const day = 86_400_000
    await database.insert(refreshTokens).values([
      {
        userId: me.body.id,
        familyId: crypto.randomUUID(),
        tokenHash: `expired-${me.body.id}`,
        expiresAt: new Date(Date.now() - 1000),
      },
      {
        userId: me.body.id,
        familyId: crypto.randomUUID(),
        tokenHash: `revoked-${me.body.id}`,
        expiresAt: new Date(Date.now() + day),
        revokedAt: new Date(Date.now() - 2 * day),
      },
      {
        userId: me.body.id,
        familyId: crypto.randomUUID(),
        tokenHash: `fresh-${me.body.id}`,
        expiresAt: new Date(Date.now() + day),
        revokedAt: new Date(),
      },
    ])
    expect((await runMaintenance()).refreshTokens).toBeGreaterThanOrEqual(2)
    const left = await database
      .select({ hash: refreshTokens.tokenHash })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, me.body.id))
    const hashes = left.map((row) => row.hash)
    expect(hashes).toContain(`fresh-${me.body.id}`)
    expect(hashes).not.toContain(`expired-${me.body.id}`)
    expect(hashes).not.toContain(`revoked-${me.body.id}`)
    // Bieżąca sesja nadal się odświeża.
    expect((await apiClient.post('/auth/refresh')).status).toBe(200)
  })
})

describe('admin panel API', () => {
  it.each(['/admin/stats', '/admin/users', '/admin/actions'])(
    'Should forbid %s to regular users',
    async (path) => {
      const { apiClient } = await registered()
      const response = await apiClient.get<{ code: string }>(path)
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('auth.forbidden')
    },
  )

  it('Should ask guests to log in', async () => {
    expect((await client().get('/admin/users')).status).toBe(401)
  })

  it('Should list and search users with entry counts, hiding demo accounts by default', async () => {
    const boss = await admin()
    const apiClient = boss.apiClient
    const other = await registered()
    await sample()
    await client().post('/auth/demo', {})

    const all = await apiClient.get<Page>('/admin/users')
    expect(all.status).toBe(200)
    expect(all.body.items.every((adminUser) => !adminUser.isDemo)).toBe(true)
    expect(all.body.total).toBeGreaterThanOrEqual(3)

    const found = await apiClient.get<Page>(
      `/admin/users?q=${encodeURIComponent(other.email.toUpperCase())}`,
    )
    expect(found.body.items.map((adminUser) => adminUser.email)).toEqual([
      other.email,
    ])
    expect(found.body.items[0]).toMatchObject({
      plan: 'free',
      role: 'client',
      entries: 0,
      disabledAt: null,
    })

    const samples = await apiClient.get<Page>('/admin/users?q=sample-')
    expect(samples.body.items[0]!.entries).toBeGreaterThan(10)

    const demos = await apiClient.get<Page>('/admin/users?status=demo')
    expect(demos.body.items.length).toBeGreaterThanOrEqual(1)
    expect(demos.body.items.every((adminUser) => adminUser.isDemo)).toBe(true)

    // „%” w wyszukiwaniu to zwykły znak, nie wzorzec dopasowujący wszystko.
    expect(
      (await apiClient.get<Page>('/admin/users?q=%25%25')).body.total,
    ).toBe(0)

    const stats = await apiClient.get<{
      users: number
      new7: number
      free: number
      demo: number
      signups: Array<{ day: string; count: number }>
    }>('/admin/stats')
    expect(stats.body.users).toBeGreaterThanOrEqual(3)
    expect(stats.body.new7).toBeGreaterThanOrEqual(3)
    expect(stats.body.new7).toBeLessThanOrEqual(stats.body.users)
    expect(stats.body.demo).toBeGreaterThanOrEqual(1)
    expect(stats.body.signups.at(-1)!.count).toBeGreaterThanOrEqual(3)
  })

  it('Should change a plan and write it to the audit log', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.apiClient.get<{ id: string }>('/account')).body.id

    const response = await boss.apiClient.patch<AdminUser>(
      `/admin/users/${id}`,
      {
        plan: 'lifetime',
      },
    )
    expect(response.status).toBe(200)
    expect(response.body.plan).toBe('lifetime')
    expect(
      (await other.apiClient.get<{ plan: string }>('/account')).body.plan,
    ).toBe('lifetime')

    const log = await boss.apiClient.get<{
      items: Array<{
        action: string
        detail: string
        targetEmail: string
        adminEmail: string
      }>
    }>(`/admin/actions?targetId=${id}`)
    expect(log.body.items[0]).toMatchObject({
      action: 'plan.changed',
      detail: 'free → lifetime',
      targetEmail: other.email,
      adminEmail: boss.email,
    })
    expect(
      (await boss.apiClient.patch(`/admin/users/${id}`, { plan: 'gold' }))
        .status,
    ).toBe(400)
    expect((await boss.apiClient.patch(`/admin/users/${id}`, {})).status).toBe(
      400,
    )
    expect(
      (await boss.apiClient.patch('/admin/users/not-a-uuid', { plan: 'pro' }))
        .status,
    ).toBe(404)
  })

  it('Should block a user at once and let them back in after unblocking', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.apiClient.get<{ id: string }>('/account')).body.id

    expect(
      (
        await boss.apiClient.patch<AdminUser>(`/admin/users/${id}`, {
          disabled: true,
        })
      ).body.disabledAt,
    ).not.toBeNull()
    // Ważny jeszcze access token już nie działa, sesji nie da się odświeżyć, logowanie jest odrzucane.
    expect((await other.apiClient.get('/account')).status).toBe(401)
    expect((await other.apiClient.post('/auth/refresh')).status).toBe(401)
    const again = await login(client(), other)
    expect(again.status).toBe(403)
    expect((again.body as unknown as { code: string }).code).toBe(
      'auth.account_disabled',
    )
    // Złe hasło do zablokowanego konta wygląda jak każde inne złe hasło.
    const wrong = await client().post<{ code: string }>('/auth/login', {
      login: other.username,
      password: 'wrong password 1',
    })
    expect(wrong.body.code).toBe('auth.invalid_credentials')

    await boss.apiClient.patch(`/admin/users/${id}`, { disabled: false })
    const back = client()
    expect((await login(back, other)).status).toBe(200)
    expect((await back.get('/account')).status).toBe(200)
  })

  it('Should protect the admin from locking themselves out', async () => {
    const boss = await admin()
    const id = (await boss.apiClient.get<{ id: string }>('/account')).body.id
    const refused = await Promise.all(
      [{ role: 'client' }, { disabled: true }].map((change) =>
        boss.apiClient.patch<{ code: string }>(`/admin/users/${id}`, change),
      ),
    )
    expect(
      refused.map((response) => [response.status, response.body.code]),
    ).toEqual([
      [400, 'admin.self'],
      [400, 'admin.self'],
    ])
    expect(
      (await boss.apiClient.del<{ code: string }>(`/admin/users/${id}`)).body
        .code,
    ).toBe('admin.self')
  })

  it('Should grant and remove the admin role with immediate effect', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.apiClient.get<{ id: string }>('/account')).body.id
    await boss.apiClient.patch(`/admin/users/${id}`, { role: 'admin' })
    expect((await other.apiClient.get('/admin/stats')).status).toBe(200)
    await boss.apiClient.patch(`/admin/users/${id}`, { role: 'client' })
    expect((await other.apiClient.get('/admin/stats')).status).toBe(403)
  })

  it('Should log a user out everywhere and delete an account with its data', async () => {
    const boss = await admin()
    const victim = await sample()
    const { id, email } = (
      await victim.get<{ id: string; email: string }>('/account')
    ).body

    expect(
      (await boss.apiClient.post(`/admin/users/${id}/revoke-sessions`)).status,
    ).toBe(204)
    expect((await victim.post('/auth/refresh')).status).toBe(401)

    const wrong = await boss.apiClient.del<{ code: string }>(
      `/admin/users/${id}`,
      {
        confirmEmail: 'someone@example.com',
      },
    )
    expect([wrong.status, wrong.body.code]).toEqual([
      400,
      'admin.confirm_email',
    ])
    expect(
      (
        await boss.apiClient.del(`/admin/users/${id}`, {
          confirmEmail: email.toUpperCase(),
        })
      ).status,
    ).toBe(204)
    expect((await boss.apiClient.get(`/admin/users/${id}`)).status).toBe(404)
    expect((await victim.get('/account')).status).toBe(401)
    const log = await boss.apiClient.get<{ items: Array<{ action: string }> }>(
      `/admin/actions?targetId=${id}`,
    )
    expect(log.body.items.map((item) => item.action)).toEqual([
      'user.deleted',
      'sessions.revoked',
    ])
  })
})

describe('account data export', () => {
  it('Should return every part of the workspace without secrets', async () => {
    const sampleUser = await sample()
    const response =
      await sampleUser.get<Record<string, unknown>>('/account/export')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="timeblame-export-\d{4}-\d{2}-\d{2}\.json"/,
    )
    expect(response.body).toMatchObject({ format: 'splits-export', version: 2 })
    expect(
      (response.body.timeEntries as Array<unknown>).length,
    ).toBeGreaterThan(10)
    expect((response.body.taskTypes as Array<unknown>).length).toBeGreaterThan(
      3,
    )
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|password_hash|tokenHash|stripeCustomerId|userId/,
    )
  })
})
