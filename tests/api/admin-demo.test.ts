import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#/server/db/client'
import { refreshTokens, users } from '#/server/db/schema'
import { runMaintenance } from '#/server/maintenance'
import { client, registered, sample } from './helpers'

type Session = {
  accessToken: string
  user: { id: string; isDemo: boolean; plan: string; role: string }
}
type AdminUser = {
  id: string
  email: string
  plan: string
  role: string
  disabledAt: string | null
  entries: number
  isDemo: boolean
}
type Page = {
  items: Array<AdminUser>
  total: number
  page: number
  pageSize: number
}

async function admin() {
  const account = await registered()
  await db
    .update(users)
    .set({ role: 'admin' })
    .where(sql`lower(${users.email}) = ${account.email}`)
  return account
}

const login = (c: ReturnType<typeof client>, account: { username: string }) =>
  c.post<Session>('/auth/login', {
    login: account.username,
    password: 'correct horse 42',
  })

describe('demo account', () => {
  it('opens a ready workspace without signing up', async () => {
    const c = client()
    const res = await c.post<Session>('/auth/demo', {
      locale: 'pl',
      timezone: 'Europe/Warsaw',
    })
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      isDemo: true,
      plan: 'pro',
      role: 'client',
    })

    const boot = await c.get<{
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
    const range = await c.get<Array<unknown>>(
      `/time-entries?from=${from}&to=${boot.body.today}`,
    )
    expect(range.body.length).toBeGreaterThan(10)
  })

  it('cannot buy, change the account or open the billing portal', async () => {
    const c = client()
    await c.post('/auth/demo', {})
    for (const res of [
      await c.post<{ code: string }>('/billing/checkout', { plan: 'pro' }),
      await c.post<{ code: string }>('/billing/portal'),
      await c.put<{ code: string }>('/account/profile', {
        displayName: 'X',
        email: 'x@example.com',
      }),
      await c.post<{ code: string }>('/account/password', {
        currentPassword: '',
        newPassword: 'new password 42',
      }),
    ]) {
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('demo.restricted')
    }
    // Zwykła praca w demo działa: wpis czasu da się dodać.
    const types =
      await c.get<Array<{ id: string; kind: string }>>('/task-types')
    const meeting = types.body.find((x) => x.kind === 'meeting')!
    const boot = await c.get<{ today: string }>('/bootstrap')
    const created = await c.post('/time-entries', {
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

  it('is removed after 24 hours together with its data', async () => {
    const c = client()
    const res = await c.post<Session>('/auth/demo', {})
    const id = res.body.user.id
    expect((await runMaintenance()).demoAccounts).toBe(0)
    await db
      .update(users)
      .set({ createdAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(eq(users.id, id))
    expect((await runMaintenance()).demoAccounts).toBeGreaterThanOrEqual(1)
    expect((await c.get('/account')).status).toBe(401)
  })
})

describe('maintenance', () => {
  it('deletes expired and long-revoked refresh tokens, keeps live ones', async () => {
    const { c } = await registered()
    const me = await c.get<{ id: string }>('/account')
    const day = 86_400_000
    await db.insert(refreshTokens).values([
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
    const left = await db
      .select({ hash: refreshTokens.tokenHash })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, me.body.id))
    const hashes = left.map((r) => r.hash)
    expect(hashes).toContain(`fresh-${me.body.id}`)
    expect(hashes).not.toContain(`expired-${me.body.id}`)
    expect(hashes).not.toContain(`revoked-${me.body.id}`)
    // Bieżąca sesja nadal się odświeża.
    expect((await c.post('/auth/refresh')).status).toBe(200)
  })
})

describe('admin panel API', () => {
  it('is closed to regular users and to guests', async () => {
    const { c } = await registered()
    for (const path of ['/admin/stats', '/admin/users', '/admin/actions']) {
      const res = await c.get<{ code: string }>(path)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('auth.forbidden')
    }
    expect((await client().get('/admin/users')).status).toBe(401)
  })

  it('lists and searches users with entry counts, hiding demo accounts by default', async () => {
    const boss = await admin()
    const c = boss.c
    const other = await registered()
    await sample()
    await client().post('/auth/demo', {})

    const all = await c.get<Page>('/admin/users')
    expect(all.status).toBe(200)
    expect(all.body.items.every((u) => !u.isDemo)).toBe(true)
    expect(all.body.total).toBeGreaterThanOrEqual(3)

    const found = await c.get<Page>(
      `/admin/users?q=${encodeURIComponent(other.email.toUpperCase())}`,
    )
    expect(found.body.items.map((u) => u.email)).toEqual([other.email])
    expect(found.body.items[0]).toMatchObject({
      plan: 'free',
      role: 'client',
      entries: 0,
      disabledAt: null,
    })

    const samples = await c.get<Page>('/admin/users?q=sample-')
    expect(samples.body.items[0]!.entries).toBeGreaterThan(10)

    const demos = await c.get<Page>('/admin/users?status=demo')
    expect(demos.body.items.length).toBeGreaterThanOrEqual(1)
    expect(demos.body.items.every((u) => u.isDemo)).toBe(true)

    // „%” w wyszukiwaniu to zwykły znak, nie wzorzec dopasowujący wszystko.
    expect((await c.get<Page>('/admin/users?q=%25%25')).body.total).toBe(0)

    const stats = await c.get<{
      users: number
      new7: number
      free: number
      demo: number
      signups: Array<{ day: string; count: number }>
    }>('/admin/stats')
    expect(stats.body.users).toBeGreaterThanOrEqual(3)
    expect(stats.body.new7).toBe(stats.body.users)
    expect(stats.body.demo).toBeGreaterThanOrEqual(1)
    expect(stats.body.signups.at(-1)!.count).toBeGreaterThanOrEqual(3)
  })

  it('changes a plan and writes it to the audit log', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.c.get<{ id: string }>('/account')).body.id

    const res = await boss.c.patch<AdminUser>(`/admin/users/${id}`, {
      plan: 'lifetime',
    })
    expect(res.status).toBe(200)
    expect(res.body.plan).toBe('lifetime')
    expect((await other.c.get<{ plan: string }>('/account')).body.plan).toBe(
      'lifetime',
    )

    const log = await boss.c.get<
      Array<{
        action: string
        detail: string
        targetEmail: string
        adminEmail: string
      }>
    >('/admin/actions')
    expect(log.body[0]).toMatchObject({
      action: 'plan.changed',
      detail: 'free → lifetime',
      targetEmail: other.email,
      adminEmail: boss.email,
    })
    expect(
      (await boss.c.patch(`/admin/users/${id}`, { plan: 'gold' })).status,
    ).toBe(400)
    expect((await boss.c.patch(`/admin/users/${id}`, {})).status).toBe(400)
    expect(
      (await boss.c.patch('/admin/users/not-a-uuid', { plan: 'pro' })).status,
    ).toBe(404)
  })

  it('blocks a user at once and lets them back in after unblocking', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.c.get<{ id: string }>('/account')).body.id

    expect(
      (await boss.c.patch<AdminUser>(`/admin/users/${id}`, { disabled: true }))
        .body.disabledAt,
    ).not.toBeNull()
    // Ważny jeszcze access token już nie działa, sesji nie da się odświeżyć, logowanie jest odrzucane.
    expect((await other.c.get('/account')).status).toBe(401)
    expect((await other.c.post('/auth/refresh')).status).toBe(401)
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

    await boss.c.patch(`/admin/users/${id}`, { disabled: false })
    const back = client()
    expect((await login(back, other)).status).toBe(200)
    expect((await back.get('/account')).status).toBe(200)
  })

  it('protects the admin from locking themselves out', async () => {
    const boss = await admin()
    const id = (await boss.c.get<{ id: string }>('/account')).body.id
    for (const change of [{ role: 'client' }, { disabled: true }]) {
      const res = await boss.c.patch<{ code: string }>(
        `/admin/users/${id}`,
        change,
      )
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('admin.self')
    }
    expect(
      (await boss.c.del<{ code: string }>(`/admin/users/${id}`)).body.code,
    ).toBe('admin.self')
  })

  it('grants and removes the admin role with immediate effect', async () => {
    const boss = await admin()
    const other = await registered()
    const id = (await other.c.get<{ id: string }>('/account')).body.id
    await boss.c.patch(`/admin/users/${id}`, { role: 'admin' })
    expect((await other.c.get('/admin/stats')).status).toBe(200)
    await boss.c.patch(`/admin/users/${id}`, { role: 'client' })
    expect((await other.c.get('/admin/stats')).status).toBe(403)
  })

  it('logs a user out everywhere and deletes an account with its data', async () => {
    const boss = await admin()
    const victim = await sample()
    const id = (await victim.get<{ id: string }>('/account')).body.id

    expect(
      (await boss.c.post(`/admin/users/${id}/revoke-sessions`)).status,
    ).toBe(204)
    expect((await victim.post('/auth/refresh')).status).toBe(401)

    expect((await boss.c.del(`/admin/users/${id}`)).status).toBe(204)
    expect((await boss.c.get(`/admin/users/${id}`)).status).toBe(404)
    expect((await victim.get('/account')).status).toBe(401)
    const log = await boss.c.get<Array<{ action: string }>>('/admin/actions')
    expect(log.body.slice(0, 2).map((a) => a.action)).toEqual([
      'user.deleted',
      'sessions.revoked',
    ])
  })
})

describe('account data export', () => {
  it('returns every part of the workspace without secrets', async () => {
    const c = await sample()
    const res = await c.get<Record<string, unknown>>('/account/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="splits-export-\d{4}-\d{2}-\d{2}\.json"/,
    )
    expect(res.body).toMatchObject({ format: 'splits-export', version: 1 })
    expect((res.body.timeEntries as Array<unknown>).length).toBeGreaterThan(10)
    expect((res.body.taskTypes as Array<unknown>).length).toBeGreaterThan(3)
    const text = JSON.stringify(res.body)
    for (const secret of [
      'passwordHash',
      'password_hash',
      'tokenHash',
      'stripeCustomerId',
      'userId',
    ])
      expect(text).not.toContain(secret)
  })
})
