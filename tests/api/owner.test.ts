import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { serverEnv } from '#/server/env'
import { client, registered } from './helpers'

type Session = { accessToken: string; user: { id: string; role: string } }
type Me = { id: string; role: string; plan: string }

const login = (c: ReturnType<typeof client>, username: string) =>
  c.post<Session>('/auth/login', {
    login: username,
    password: 'correct horse 42',
  })

const verify = (email: string) =>
  db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(sql`lower(${users.email}) = ${email}`)

/** Konto z ADMIN_EMAILS z potwierdzonym adresem, zalogowane ponownie. */
async function owner() {
  const account = await registered()
  serverEnv.adminEmails.add(account.email)
  await verify(account.email)
  const session = await login(account.c, account.username)
  return { ...account, id: session.body.user.id, session }
}

afterEach(() => serverEnv.adminEmails.clear())

describe('owner superuser (ADMIN_EMAILS)', () => {
  it('becomes admin on login, but only with a verified email', async () => {
    const account = await registered()
    serverEnv.adminEmails.add(account.email)

    // Ktoś mógł założyć konto na cudzy adres: bez potwierdzenia nie ma panelu.
    const unverified = await login(account.c, account.username)
    expect(unverified.body.user.role).toBe('client')
    expect((await account.c.get('/admin/stats')).status).toBe(403)

    await verify(account.email)
    const verified = await login(account.c, account.username)
    expect(verified.body.user.role).toBe('admin')
    expect((await account.c.get('/admin/stats')).status).toBe(200)
  })

  it('is promoted on token refresh, without logging in again', async () => {
    const account = await registered()
    serverEnv.adminEmails.add(account.email)
    await verify(account.email)
    const refreshed = await account.c.post<Session>('/auth/refresh')
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.user.role).toBe('admin')
  })

  it('confirms the email address through a password reset link', async () => {
    const account = await registered()
    serverEnv.adminEmails.add(account.email)
    const logs: Array<string> = []
    const original = console.info
    console.info = (msg: string) => logs.push(msg)
    try {
      await client().post('/auth/forgot-password', { email: account.email })
    } finally {
      console.info = original
    }
    const token = /reset-password\?token=([\w-]+)/.exec(logs.join('\n'))![1]!
    expect(
      (
        await client().post('/auth/reset-password', {
          token,
          password: 'correct horse 42',
        })
      ).status,
    ).toBe(204)
    const c = client()
    expect((await login(c, account.username)).body.user.role).toBe('admin')
  })

  it('gets every Pro feature on the Free plan without paying', async () => {
    const { c } = await owner()
    const me = await c.get<Me>('/account')
    expect(me.body.plan).toBe('free')

    // Pełna historia: wpis sprzed 60 dni jest widoczny.
    const types =
      await c.get<Array<Record<string, unknown> & { id: string }>>(
        '/task-types',
      )
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
    }).format(new Date())
    const old = new Date(Date.now() - 60 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const created = await c.post('/time-entries', {
      taskTypeId: types.body[0]!.id,
      projectId: null,
      title: 'Old task',
      link: null,
      storyPoints: 1,
      workDate: old,
      startTime: null,
      endTime: null,
      durationMinutes: 30,
      note: null,
      running: false,
    })
    expect(created.status).toBe(201)
    const range = await c.get<Array<{ workDate: string }>>(
      `/time-entries?from=2000-01-01&to=${today}`,
    )
    expect(range.body.map((e) => e.workDate)).toContain(old)

    // Bez limitu własnych typów pracy.
    const { id: _id, ...base } = types.body[1]!
    for (let i = 1; i <= 5; i++) {
      const res = await c.post('/task-types', { ...base, name: `Custom ${i}` })
      expect(res.status).toBe(201)
    }

    // Kupowanie samemu sobie nie ma sensu.
    const checkout = await c.post<{ code: string }>('/billing/checkout', {
      plan: 'pro',
    })
    expect(checkout.status).toBe(409)
    expect(checkout.body.code).toBe('billing.already_subscribed')
  })

  it('cannot be demoted, blocked or deleted by another admin', async () => {
    const boss = await owner()
    const other = await registered()
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(sql`lower(${users.email}) = ${other.email}`)
    await login(other.c, other.username)

    const listed = await other.c.get<{
      items: Array<{ id: string; isOwner: boolean }>
    }>(`/admin/users?q=${encodeURIComponent(boss.email)}`)
    expect(listed.body.items.find((u) => u.id === boss.id)?.isOwner).toBe(true)

    for (const change of [{ role: 'client' }, { disabled: true }]) {
      const res = await other.c.patch<{ code: string }>(
        `/admin/users/${boss.id}`,
        change,
      )
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('admin.owner')
    }
    const deleted = await other.c.del<{ code: string }>(
      `/admin/users/${boss.id}`,
    )
    expect(deleted.body.code).toBe('admin.owner')

    // Zmiana planu właściciela jest dozwolona (np. testy płatności).
    expect(
      (await other.c.patch(`/admin/users/${boss.id}`, { plan: 'pro' })).status,
    ).toBe(200)
    expect((await boss.c.get('/admin/stats')).status).toBe(200)
  })
})
