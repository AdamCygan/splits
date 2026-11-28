import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { database } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { serverEnv } from '#/server/env'
import { client, inSequence, numbered, registered } from './helpers'

interface Session {
  accessToken: string
  user: { id: string; role: string }
}
interface Me {
  id: string
  role: string
  plan: string
}

const login = (apiClient: ReturnType<typeof client>, username: string) =>
  apiClient.post<Session>('/auth/login', {
    login: username,
    password: 'correct horse 42',
  })

const verify = (email: string) =>
  database
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(sql`lower(${users.email}) = ${email}`)

/** Konto z ADMIN_EMAILS z potwierdzonym adresem, zalogowane ponownie. */
async function owner() {
  const account = await registered()
  serverEnv.adminEmails.add(account.email)
  await verify(account.email)
  const session = await login(account.apiClient, account.username)
  return { ...account, id: session.body.user.id, session }
}

afterEach(() => serverEnv.adminEmails.clear())

describe('owner superuser (ADMIN_EMAILS)', () => {
  it('Should become admin on login, but only with a verified email', async () => {
    const account = await registered('en', { verify: false })
    serverEnv.adminEmails.add(account.email)

    // Ktoś mógł założyć konto na cudzy adres: bez potwierdzenia nie ma panelu.
    const unverified = await login(account.apiClient, account.username)
    expect(unverified.body.user.role).toBe('client')
    expect((await account.apiClient.get('/admin/stats')).status).toBe(403)

    await verify(account.email)
    const verified = await login(account.apiClient, account.username)
    expect(verified.body.user.role).toBe('admin')
    expect((await account.apiClient.get('/admin/stats')).status).toBe(200)
  })

  it('Should be promoted on token refresh, without logging in again', async () => {
    const account = await registered()
    serverEnv.adminEmails.add(account.email)
    await verify(account.email)
    const refreshed = await account.apiClient.post<Session>('/auth/refresh')
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.user.role).toBe('admin')
  })

  it('Should confirm the email address through a password reset link', async () => {
    const account = await registered('en', { verify: false })
    serverEnv.adminEmails.add(account.email)
    const logs: Array<string> = []
    const original = console.info
    console.info = (message: string) => logs.push(message)
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
    const apiClient = client()
    expect((await login(apiClient, account.username)).body.user.role).toBe(
      'admin',
    )
  })

  it('Should get every Pro feature on the Free plan without paying', async () => {
    const { apiClient } = await owner()
    const me = await apiClient.get<Me>('/account')
    expect(me.body.plan).toBe('free')

    // Pełna historia: wpis sprzed 60 dni jest widoczny.
    const types =
      await apiClient.get<Array<Record<string, unknown> & { id: string }>>(
        '/task-types',
      )
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
    }).format(new Date())
    const old = new Date(Date.now() - 60 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const created = await apiClient.post('/time-entries', {
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
    const range = await apiClient.get<Array<{ workDate: string }>>(
      `/time-entries?from=2000-01-01&to=${today}`,
    )
    expect(range.body.map((entry) => entry.workDate)).toContain(old)

    // Bez limitu własnych typów pracy.
    const { id: _id, ...base } = types.body[1]!
    const custom = await inSequence(numbered(5), (index) =>
      apiClient.post('/task-types', { ...base, name: `Custom ${index}` }),
    )
    expect(custom.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ])

    // Kupowanie samemu sobie nie ma sensu.
    const checkout = await apiClient.post<{ code: string }>(
      '/billing/checkout',
      {
        plan: 'pro',
      },
    )
    expect(checkout.status).toBe(409)
    expect(checkout.body.code).toBe('billing.already_subscribed')
  })

  it('Should not be demoted, blocked or deleted by another admin', async () => {
    const boss = await owner()
    const other = await registered()
    await database
      .update(users)
      .set({ role: 'admin' })
      .where(sql`lower(${users.email}) = ${other.email}`)
    await login(other.apiClient, other.username)

    const listed = await other.apiClient.get<{
      items: Array<{ id: string; isOwner: boolean }>
    }>(`/admin/users?q=${encodeURIComponent(boss.email)}`)
    expect(listed.body.items.find((item) => item.id === boss.id)?.isOwner).toBe(
      true,
    )

    const refused = await Promise.all(
      [{ role: 'client' }, { disabled: true }].map((change) =>
        other.apiClient.patch<{ code: string }>(
          `/admin/users/${boss.id}`,
          change,
        ),
      ),
    )
    expect(
      refused.map((response) => [response.status, response.body.code]),
    ).toEqual([
      [400, 'admin.owner'],
      [400, 'admin.owner'],
    ])
    const deleted = await other.apiClient.del<{ code: string }>(
      `/admin/users/${boss.id}`,
    )
    expect(deleted.body.code).toBe('admin.owner')

    // Zmiana planu właściciela jest dozwolona (np. testy płatności).
    expect(
      (await other.apiClient.patch(`/admin/users/${boss.id}`, { plan: 'pro' }))
        .status,
    ).toBe(200)
    expect((await boss.apiClient.get('/admin/stats')).status).toBe(200)
  })
})
