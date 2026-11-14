import Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { planForPrice, setStripeClient } from '#/server/billing/stripe'
import { db } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { client, registered } from './helpers'

/**
 * Płatności na prawdziwym API i bazie, z fałszywym klientem Stripe (bez sieci).
 * Webhooki są podpisywane prawdziwym algorytmem Stripe, więc weryfikacja podpisu jest testowana naprawdę.
 */
const SECRET = 'whsec_test_secret'
const real = new Stripe('sk_test_fake')

type Sub = {
  id: string
  customer: string
  status: string
  metadata: Record<string, string>
  cancel_at_period_end: boolean
  cancel_at: number | null
  items: {
    data: Array<{
      price: { id: string; lookup_key: string | null }
      quantity: number
      current_period_end: number
    }>
  }
}

const state = {
  customers: [] as Array<{
    id: string
    email: string
    metadata: Record<string, string>
  }>,
  sessions: new Map<
    string,
    {
      client_reference_id: string
      subscription: string | null
      payment_status: string
    }
  >(),
  subs: new Map<string, Sub>(),
  checkoutParams: [] as Array<Record<string, unknown>>,
  canceled: [] as Array<string>,
}
let n = 0
const nextYear = Math.floor(Date.now() / 1000) + 365 * 86_400

const fake = {
  webhooks: real.webhooks,
  prices: {
    list: async ({ lookup_keys }: { lookup_keys: Array<string> }) => ({
      data: lookup_keys.includes('splits_pro_yearly')
        ? [{ id: 'price_pro_yearly', lookup_key: 'splits_pro_yearly' }]
        : [],
    }),
  },
  customers: {
    create: async (params: {
      email: string
      metadata: Record<string, string>
    }) => {
      const customer = { id: `cus_${++n}`, ...params }
      state.customers.push(customer)
      return customer
    },
  },
  checkout: {
    sessions: {
      create: async (params: Record<string, unknown>) => {
        state.checkoutParams.push(params)
        const id = `cs_test_${++n}`
        state.sessions.set(id, {
          client_reference_id: params.client_reference_id as string,
          subscription: null,
          payment_status: 'unpaid',
        })
        return { id, url: `https://checkout.stripe.com/c/pay/${id}` }
      },
      retrieve: async (id: string) => {
        const session = state.sessions.get(id)
        if (!session) throw new Error('No such session')
        return { id, ...session }
      },
    },
  },
  subscriptions: {
    retrieve: async (id: string) => {
      const sub = state.subs.get(id)
      if (!sub) throw new Error('No such subscription')
      return sub
    },
    cancel: async (id: string) => {
      state.canceled.push(id)
      const sub = state.subs.get(id)
      if (!sub) return { id, status: 'canceled' }
      const ended = { ...sub, status: 'canceled' }
      state.subs.set(id, ended)
      return ended
    },
  },
  billingPortal: {
    sessions: {
      create: async ({ customer }: { customer: string }) => ({
        url: `https://billing.stripe.com/p/session/${customer}`,
      }),
    },
  },
}
setStripeClient(fake as unknown as Stripe)
afterAll(() => setStripeClient(null))

/** Wysyła zdarzenie do webhooka z poprawnym (albo złym) podpisem Stripe-Signature. */
async function webhook(
  event: { id: string; type: string; data: { object: unknown } },
  secret = SECRET,
) {
  const payload = JSON.stringify({
    object: 'event',
    api_version: '2026-10-28.endive',
    ...event,
  })
  const signature = await real.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
  })
  return client().post<{
    received?: boolean
    duplicate?: boolean
    code?: string
  }>('/stripe/webhook', undefined, {
    'Stripe-Signature': signature,
    'Content-Type': 'application/json',
    __raw: payload,
  })
}

function makeSub(
  userId: string,
  customer: string,
  patch: Partial<Sub> = {},
): Sub {
  return {
    id: `sub_${++n}`,
    customer,
    status: 'active',
    metadata: { userId, plan: 'pro' },
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        {
          price: { id: 'price_pro_yearly', lookup_key: 'splits_pro_yearly' },
          quantity: 1,
          current_period_end: nextYear,
        },
      ],
    },
    ...patch,
  }
}

type Billing = {
  enabled: boolean
  plan: string
  subscription: null | {
    status: string
    active: boolean
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
}

/** Konto po zakupie Pro: koszyk → Checkout → webhook checkout.session.completed. */
async function buyPro() {
  const { c } = await registered()
  const me = await c.get<{ id: string }>('/account')
  const checkout = await c.post<{ url: string }>('/billing/checkout', {
    plan: 'pro',
  })
  const sessionId = /cs_test_\d+/.exec(checkout.body.url)![0]
  const customer = state.customers.at(-1)!.id
  const sub = makeSub(me.body.id, customer)
  state.subs.set(sub.id, sub)
  state.sessions.set(sessionId, {
    client_reference_id: me.body.id,
    subscription: sub.id,
    payment_status: 'paid',
  })
  const res = await webhook({
    id: `evt_${++n}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        mode: 'subscription',
        client_reference_id: me.body.id,
        subscription: sub.id,
        customer,
      },
    },
  })
  expect(res.status).toBe(200)
  return { c, userId: me.body.id, sub, sessionId, customer }
}

beforeEach(() => {
  state.checkoutParams.length = 0
})

describe('billing (Stripe, yearly plans only)', () => {
  it('opens a yearly Pro checkout for a free account', async () => {
    const { c } = await registered()
    const me = await c.get<{ id: string; email: string }>('/account')
    const status = await c.get<Billing>('/billing')
    expect(status.body).toEqual({
      enabled: true,
      plan: 'free',
      subscription: null,
    })

    const res = await c.post<{ url: string }>('/billing/checkout', {
      plan: 'pro',
    })
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    const params = state.checkoutParams[0]!
    expect(params).toMatchObject({
      mode: 'subscription',
      client_reference_id: me.body.id,
      line_items: [{ price: 'price_pro_yearly', quantity: 1 }],
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      subscription_data: { metadata: { userId: me.body.id, plan: 'pro' } },
    })
    expect(params.success_url).toContain(
      '/app/settings/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    )
    expect(params.cancel_url).toContain('/app/checkout?plan=pro&canceled=1')

    // Drugie podejście używa tego samego klienta Stripe.
    const customers = state.customers.length
    await c.post('/billing/checkout', { plan: 'pro' })
    expect(state.customers.length).toBe(customers)
    expect(state.checkoutParams[1]!.customer).toBe(params.customer)
    expect(state.customers.at(-1)!.email).toBe(me.body.email)
  })

  it('accepts only a yearly Pro plan', async () => {
    const { c } = await registered()
    for (const plan of ['pro_monthly', 'lifetime', 'team'])
      expect((await c.post('/billing/checkout', { plan })).status).toBe(400)
  })

  it('turns Pro on from a signed webhook and processes each event once', async () => {
    const { c, sub } = await buyPro()
    expect((await c.get<{ plan: string }>('/account')).body.plan).toBe('pro')
    const status = await c.get<Billing>('/billing')
    expect(status.body.subscription).toMatchObject({
      status: 'active',
      active: true,
      cancelAtPeriodEnd: false,
    })
    expect(
      new Date(status.body.subscription!.currentPeriodEnd!).getTime(),
    ).toBe(nextYear * 1000)
    expect(
      (await c.post<{ code: string }>('/billing/checkout', { plan: 'pro' }))
        .body.code,
    ).toBe('billing.already_subscribed')

    const event = {
      id: `evt_${++n}`,
      type: 'customer.subscription.updated',
      data: { object: { id: sub.id, object: 'subscription' } },
    }
    state.subs.set(sub.id, { ...sub, cancel_at_period_end: true })
    expect((await webhook(event)).body).toEqual({ received: true })
    expect((await webhook(event)).body).toEqual({
      received: true,
      duplicate: true,
    })
    expect(
      (await c.get<Billing>('/billing')).body.subscription?.cancelAtPeriodEnd,
    ).toBe(true)
  })

  it('rejects webhooks with a wrong signature', async () => {
    const res = await webhook(
      {
        id: `evt_${++n}`,
        type: 'checkout.session.completed',
        data: { object: {} },
      },
      'whsec_someone_else',
    )
    expect(res.status).toBe(400)
    const unsigned = await client().post('/stripe/webhook', { id: 'evt_x' })
    expect(unsigned.status).toBe(400)
  })

  it('goes back to Free when the subscription ends', async () => {
    const { c, sub } = await buyPro()
    state.subs.set(sub.id, { ...sub, status: 'canceled' })
    await webhook({
      id: `evt_${++n}`,
      type: 'customer.subscription.deleted',
      data: { object: { id: sub.id, object: 'subscription' } },
    })
    expect((await c.get<{ plan: string }>('/account')).body.plan).toBe('free')
    expect((await c.get<Billing>('/billing')).body.subscription?.active).toBe(
      false,
    )
  })

  it('keeps Pro during a payment retry (past_due)', async () => {
    const { c, sub } = await buyPro()
    state.subs.set(sub.id, { ...sub, status: 'past_due' })
    await webhook({
      id: `evt_${++n}`,
      type: 'customer.subscription.updated',
      data: { object: { id: sub.id, object: 'subscription' } },
    })
    expect((await c.get<{ plan: string }>('/account')).body.plan).toBe('pro')
    expect((await c.get<Billing>('/billing')).body.subscription?.status).toBe(
      'past_due',
    )
  })

  it('syncs right after returning from checkout, only for the owner', async () => {
    const { c } = await registered()
    const me = await c.get<{ id: string }>('/account')
    const checkout = await c.post<{ url: string }>('/billing/checkout', {
      plan: 'pro',
    })
    const sessionId = /cs_test_\d+/.exec(checkout.body.url)![0]
    const sub = makeSub(me.body.id, state.customers.at(-1)!.id)
    state.subs.set(sub.id, sub)
    state.sessions.set(sessionId, {
      client_reference_id: me.body.id,
      subscription: sub.id,
      payment_status: 'paid',
    })

    const other = (await registered()).c
    expect((await other.post('/billing/sync', { sessionId })).status).toBe(404)
    const synced = await c.post<{ plan: string; paid: boolean }>(
      '/billing/sync',
      { sessionId },
    )
    expect(synced.body).toEqual({ plan: 'pro', paid: true })
  })

  it('opens the customer portal and cancels billing when the account is deleted', async () => {
    const { c, sub, customer } = await buyPro()
    const portal = await c.post<{ url: string }>('/billing/portal')
    expect(portal.body.url).toBe(
      `https://billing.stripe.com/p/session/${customer}`,
    )
    await c.del('/account', { password: 'correct horse 42' })
    expect(state.canceled).toContain(sub.id)
  })

  it('ends Pro and the subscription after a full refund, not a partial one', async () => {
    const { c, sub, customer } = await buyPro()
    const charge = (refunded: boolean) => ({
      id: `evt_${++n}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_${n}`,
          object: 'charge',
          customer,
          refunded,
          amount: 2400,
          amount_refunded: refunded ? 2400 : 500,
        },
      },
    })

    expect((await webhook(charge(false))).status).toBe(200)
    expect(state.canceled).not.toContain(sub.id)
    expect((await c.get<{ plan: string }>('/account')).body.plan).toBe('pro')

    expect((await webhook(charge(true))).status).toBe(200)
    expect(state.canceled).toContain(sub.id)
    expect((await c.get<{ plan: string }>('/account')).body.plan).toBe('free')
    expect((await c.get<Billing>('/billing')).body.subscription).toMatchObject({
      status: 'canceled',
      active: false,
    })
  })

  it('limits Free reports to the last 30 days on the server', async () => {
    const { c, email } = await registered()
    const types = await c.get<Array<{ id: string }>>('/task-types')
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
    }).format(new Date())
    const old = new Date(Date.now() - 60 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const entry = (workDate: string) => ({
      taskTypeId: types.body[0]!.id,
      projectId: null,
      title: `Task ${workDate}`,
      link: null,
      storyPoints: 1,
      workDate,
      startTime: null,
      endTime: null,
      durationMinutes: 30,
      note: null,
      running: false,
    })
    // Starszego wpisu Free nie doda (limit 30 dni), ale może go mieć z czasów Pro.
    expect((await c.post('/time-entries', entry(old))).status).toBe(403)
    await db
      .update(users)
      .set({ plan: 'pro' })
      .where(sql`lower(${users.email}) = ${email}`)
    await c.post('/time-entries', entry(old))
    await db
      .update(users)
      .set({ plan: 'free' })
      .where(sql`lower(${users.email}) = ${email}`)
    await c.post('/time-entries', entry(today))
    const range = await c.get<Array<{ workDate: string }>>(
      `/time-entries?from=2000-01-01&to=${today}`,
    )
    expect(range.body.map((e) => e.workDate)).toEqual([today])
  })
})

describe('planForPrice', () => {
  it('keeps Pro for an older price that lost its lookup key', () => {
    expect(
      planForPrice({
        id: 'price_old',
        lookup_key: null,
        metadata: { plan: 'pro' },
      }),
    ).toBe('pro')
    expect(planForPrice({ id: 'price_other', lookup_key: null })).toBeNull()
  })
})
