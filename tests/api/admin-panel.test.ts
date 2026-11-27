import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { encryptSecret, newTotpSecret } from '#/server/auth/totp'
import { setStripeClient } from '#/server/billing/stripe'
import { db } from '#/server/db/client'
import { payments, subscriptions, users } from '#/server/db/schema'
import { outbox } from '#/server/email'
import { serverEnv } from '#/server/env'
import { client, registered, registeredAdmin } from './helpers'
import type { ApiClient } from './helpers'

interface Row {
  id: string
  email: string
  entries: number
  displayName: string
  twoFactor: boolean
  emailVerified: boolean
}
interface Page {
  items: Array<Row>
  total: number
}
interface Action {
  action: string
  detail: string | null
  targetEmail: string | null
  adminEmail: string
}
interface ActionPage {
  items: Array<Action>
  total: number
  pageSize: number
}
interface Detail extends Row {
  security: {
    emailVerified: boolean
    pendingEmail: string | null
    twoFactor: boolean
  }
  sessions: Array<{ id: string; userAgent: string | null }>
  billing: { enabled: boolean; stripeCustomerId: string | null }
}

const DAY = 86_400_000
const idOf = async (c: ApiClient) =>
  (await c.get<{ id: string }>('/account')).body.id

/** Włącza 2FA bezpośrednio w bazie (ekran włączania nie jest tematem tych testów). */
const turnOnTwoFactor = (userId: string) =>
  db
    .update(users)
    .set({
      totpSecret: encryptSecret(newTotpSecret()),
      totpEnabledAt: new Date(),
      recoveryCodes: [],
    })
    .where(eq(users.id, userId))

const subscribe = (userId: string, status: string) =>
  db.insert(subscriptions).values({
    id: `sub_admin_${userId}`,
    userId,
    stripeCustomerId: `cus_admin_${userId}`,
    status,
    plan: 'pro',
    priceId: 'price_test',
  })

const makeOld = (userId: string) =>
  db
    .update(users)
    .set({ createdAt: new Date(Date.now() - 60 * DAY) })
    .where(eq(users.id, userId))

/** Jeden wpis czasu dodany teraz (aktywność konta). */
async function logTime(c: ApiClient) {
  const types = await c.get<Array<{ id: string; kind: string }>>('/task-types')
  const meeting = types.body.find((t) => t.kind === 'meeting')!
  await c.post('/time-entries', {
    taskTypeId: meeting.id,
    projectId: null,
    title: 'Stand-up',
    link: null,
    storyPoints: null,
    workDate: '2026-11-20',
    startTime: null,
    endTime: null,
    durationMinutes: 15,
    note: null,
    running: false,
  })
}

interface FilterCase {
  /** Przygotowuje konto pasujące do filtra (`match`) i niepasujące (`other`). */
  prepare: (match: ApiClient, other: ApiClient) => Promise<void>
  verifyMatch?: boolean
}

describe('admin user list', () => {
  it.each<[string, string, FilterCase]>([
    [
      'an unconfirmed email',
      'email=unverified',
      { prepare: async () => undefined, verifyMatch: false },
    ],
    [
      'two-step login turned on',
      'twoFactor=on',
      {
        prepare: async (match) =>
          void (await turnOnTwoFactor(await idOf(match))),
      },
    ],
    [
      'two-step login turned off',
      'twoFactor=off',
      {
        prepare: async (_, other) =>
          void (await turnOnTwoFactor(await idOf(other))),
      },
    ],
    [
      'a payment problem',
      'payment=problem',
      {
        prepare: async (match, other) => {
          await subscribe(await idOf(match), 'past_due')
          await subscribe(await idOf(other), 'active')
        },
      },
    ],
    [
      'no new entries for 30 days',
      'inactiveDays=30',
      {
        prepare: async (match, other) => {
          await makeOld(await idOf(match))
          await makeOld(await idOf(other))
          await logTime(other)
        },
      },
    ],
  ])('Should find accounts with %s (%s)', async (_case, query, setup) => {
    const boss = await registeredAdmin()
    const match = await registered('en', { verify: setup.verifyMatch ?? true })
    const other = await registered()
    await setup.prepare(match.c, other.c)
    const emails = async (email: string) =>
      (
        await boss.c.get<Page>(
          `/admin/users?${query}&q=${encodeURIComponent(email)}`,
        )
      ).body.items.map((u) => u.email)
    expect(await emails(match.email)).toEqual([match.email])
    expect(await emails(other.email)).toEqual([])
  })

  it.each<[string, string, (rows: Array<Row>) => Array<string | number>]>([
    [
      'entries, most first',
      'sort=entries&dir=desc',
      (rows) => rows.map((u) => u.entries),
    ],
    [
      'entries, fewest first',
      'sort=entries&dir=asc',
      (rows) => rows.map((u) => u.entries),
    ],
    [
      'name, A to Z',
      'sort=name&dir=asc',
      (rows) => rows.map((u) => u.displayName.toLowerCase()),
    ],
  ])('Should sort users by %s', async (_case, query, key) => {
    const boss = await registeredAdmin()
    const values = key(
      (await boss.c.get<Page>(`/admin/users?${query}`)).body.items,
    )
    const sorted = [...values].sort((a, b) =>
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b)),
    )
    expect(values).toEqual(query.includes('desc') ? sorted.reverse() : sorted)
  })

  it('Should export every matching account and write the export to the log', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const exported = await boss.c.get<Array<Row>>(
      `/admin/users/export?q=${encodeURIComponent(other.email)}`,
    )
    expect(exported.body.map((u) => u.email)).toEqual([other.email])
    const log = await boss.c.get<ActionPage>(
      `/admin/actions?action=users.exported&admin=${encodeURIComponent(boss.email)}`,
    )
    expect(log.body.items[0]).toMatchObject({
      action: 'users.exported',
      targetEmail: null,
      detail: `1; q=${other.email}, sort=created`,
    })
  })
})

describe('admin account page', () => {
  it('Should show security, signed-in devices and payments of the account', async () => {
    const boss = await registeredAdmin()
    const other = await registered('en', { verify: false })
    const res = await boss.c.get<Detail>(`/admin/users/${await idOf(other.c)}`)
    expect(res.body).toMatchObject({
      email: other.email,
      emailVerified: false,
      twoFactor: false,
      security: { emailVerified: false, pendingEmail: null, twoFactor: false },
      billing: { enabled: true, stripeCustomerId: null },
    })
    expect(res.body.sessions).toHaveLength(1)
  })

  it('Should send a new confirmation link only to an unconfirmed address', async () => {
    const boss = await registeredAdmin()
    const other = await registered('en', { verify: false })
    const id = await idOf(other.c)
    const before = outbox.filter((m) => m.to === other.email).length
    expect((await boss.c.post(`/admin/users/${id}/email/verify`)).status).toBe(
      204,
    )
    expect(outbox.filter((m) => m.to === other.email)).toHaveLength(before + 1)

    const verified = await registered()
    const again = await boss.c.post<{ code: string }>(
      `/admin/users/${await idOf(verified.c)}/email/verify`,
    )
    expect([again.status, again.body.code]).toEqual([
      409,
      'auth.already_verified',
    ])
  })

  it('Should cancel a pending email change and log the address', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const id = await idOf(other.c)
    const next = `next-${other.email}`
    await other.c.post('/account/email', {
      email: next,
      password: 'correct horse 42',
    })
    expect((await boss.c.del(`/admin/users/${id}/email/pending`)).status).toBe(
      204,
    )
    expect(
      (await other.c.get<{ pendingEmail: string | null }>('/account/security'))
        .body.pendingEmail,
    ).toBeNull()
    expect((await boss.c.del(`/admin/users/${id}/email/pending`)).status).toBe(
      404,
    )
    const log = await boss.c.get<ActionPage>(`/admin/actions?targetId=${id}`)
    expect(log.body.items[0]).toMatchObject({
      action: 'email.change_canceled',
      detail: next,
    })
  })

  it('Should log out one device and keep the others signed in', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const id = await idOf(other.c)
    const laptop = client()
    await laptop.post('/auth/login', {
      login: other.username,
      password: 'correct horse 42',
    })
    const before = await boss.c.get<Detail>(`/admin/users/${id}`)
    // Najnowsza sesja jest pierwsza: to ta z drugiego logowania.
    const newest = before.body.sessions[0]!
    expect(
      (await boss.c.del(`/admin/users/${id}/sessions/${newest.id}`)).status,
    ).toBe(204)
    const [laptopRefresh, firstRefresh] = await Promise.all([
      laptop.post('/auth/refresh'),
      other.c.post('/auth/refresh'),
    ])
    expect([laptopRefresh.status, firstRefresh.status]).toEqual([401, 200])
    expect(
      (await boss.c.del(`/admin/users/${id}/sessions/${newest.id}`)).status,
    ).toBe(404)
  })

  it('Should turn off two-step login only with a reason, log out everywhere and email the owner', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const id = await idOf(other.c)
    await turnOnTwoFactor(id)
    const short = await boss.c.post(`/admin/users/${id}/2fa/disable`, {
      reason: 'ok',
    })
    expect(short.status).toBe(400)
    const reason = 'Replied from the account email with the last invoice number'
    expect(
      (await boss.c.post(`/admin/users/${id}/2fa/disable`, { reason })).status,
    ).toBe(204)
    const detail = await boss.c.get<Detail>(`/admin/users/${id}`)
    expect(detail.body.security.twoFactor).toBe(false)
    expect(detail.body.sessions).toEqual([])
    expect(outbox.filter((m) => m.to === other.email).at(-1)?.subject).toBe(
      'Two-step login was turned off',
    )
    const log = await boss.c.get<ActionPage>(`/admin/actions?targetId=${id}`)
    expect(log.body.items[0]).toMatchObject({
      action: 'two_factor.disabled',
      detail: reason,
    })
  })

  it('Should not let an admin turn off their own two-step login here', async () => {
    const boss = await registeredAdmin()
    const id = await idOf(boss.c)
    await turnOnTwoFactor(id)
    const res = await boss.c.post<{ code: string }>(
      `/admin/users/${id}/2fa/disable`,
      { reason: 'Lost my phone, honestly' },
    )
    expect([res.status, res.body.code]).toEqual([400, 'admin.self'])
  })

  it('Should log a look at the invoices of a Stripe customer', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const id = await idOf(other.c)
    await db
      .update(users)
      .set({ stripeCustomerId: `cus_invoices_${id}` })
      .where(eq(users.id, id))
    // Klient Stripe bez sieci: lista faktur tego klienta jest pusta.
    setStripeClient({
      invoices: { list: async () => ({ data: [] }) },
    } as unknown as Stripe)
    const invoices = await boss.c.get(`/admin/users/${id}/invoices`)
    expect([invoices.status, invoices.body]).toEqual([200, []])
    const log = await boss.c.get<ActionPage>(`/admin/actions?targetId=${id}`)
    expect(log.body.items.map((a) => a.action)).toEqual(['invoices.viewed'])
  })
})

describe('admin activity log', () => {
  it('Should filter by action and account and page through the results', async () => {
    const boss = await registeredAdmin()
    const other = await registered()
    const id = await idOf(other.c)
    await boss.c.patch(`/admin/users/${id}`, { plan: 'lifetime' })
    await boss.c.patch(`/admin/users/${id}`, { disabled: true })
    const res = await boss.c.get<ActionPage>(
      `/admin/actions?action=user.blocked&target=${encodeURIComponent(other.email)}`,
    )
    expect(res.body).toMatchObject({ total: 1, pageSize: 25 })
    expect(res.body.items[0]).toMatchObject({
      action: 'user.blocked',
      targetEmail: other.email,
      adminEmail: boss.email,
    })
    expect((await boss.c.get('/admin/actions?action=nope')).status).toBe(400)
  })
})

describe('admin numbers', () => {
  it('Should count revenue from payments minus refunds, per currency', async () => {
    const boss = await registeredAdmin()
    const paid = (days: number, amountRefunded: number) => ({
      id: `ch_xts_${days}_${Date.now()}`,
      amount: 4900,
      amountRefunded,
      // XTS: kod waluty zarezerwowany na testy, więc inne testy go nie dotykają.
      currency: 'xts',
      paidAt: new Date(Date.now() - days * DAY),
    })
    await db
      .insert(payments)
      .values([paid(10, 0), paid(100, 1000), paid(400, 0)])
    const stats = await boss.c.get<{
      revenue: Array<{
        currency: string
        last30: number
        last365: number
        refunded365: number
      }>
      active7: number
      active30: number
    }>('/admin/stats')
    expect(stats.body.revenue.find((r) => r.currency === 'xts')).toEqual({
      currency: 'xts',
      last30: 4900,
      last365: 8800,
      refunded365: 1000,
    })
    expect(stats.body.active7).toBeLessThanOrEqual(stats.body.active30)
  })

  it('Should count an account as active only after it logs time', async () => {
    const boss = await registeredAdmin()
    const before = (await boss.c.get<{ active7: number }>('/admin/stats')).body
    const worker = await registered()
    // Samo logowanie (rejestracja) nie robi z konta aktywnego.
    await registered()
    await logTime(worker.c)
    const after = (await boss.c.get<{ active7: number }>('/admin/stats')).body
    expect(after.active7 - before.active7).toBe(1)
  })
})

describe('two-step login required for admins', () => {
  const env = serverEnv as { adminRequire2fa: boolean }
  afterEach(() => {
    env.adminRequire2fa = false
  })

  it('Should close the panel to admins without two-step login while it is required', async () => {
    const boss = await registeredAdmin()
    env.adminRequire2fa = true
    const closed = await boss.c.get<{ code: string }>('/admin/stats')
    expect([closed.status, closed.body.code]).toEqual([
      403,
      'admin.two_factor_required',
    ])
    await turnOnTwoFactor(await idOf(boss.c))
    expect((await boss.c.get('/admin/stats')).status).toBe(200)
  })
})
