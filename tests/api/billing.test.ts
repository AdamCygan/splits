import Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import {
  planForPrice,
  setStripeClient,
} from '../../src/features/billing/data/stripe.server'
import { database } from '#/server/db/client'
import { payments, users } from '#/server/db/schema'
import { client, lastDeleteCode, registered } from './helpers'

/**
 * Płatności na prawdziwym API i bazie, z fałszywym klientem Stripe (bez sieci).
 * Webhooki są podpisywane prawdziwym algorytmem Stripe, więc weryfikacja podpisu jest testowana naprawdę.
 */
const SECRET = 'whsec_test_secret'
const real = new Stripe('sk_test_fake')

interface Sub {
  id: string
  customer: string
  status: string
  metadata: Record<string, string>
  cancel_at_period_end: boolean
  cancel_at: number | null
  items: {
    data: Array<{
      price: {
        id: string
        lookup_key: string | null
        recurring?: { interval: string }
      }
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
  subscriptions: new Map<string, Sub>(),
  checkoutParams: [] as Array<Record<string, unknown>>,
  canceled: [] as Array<string>,
}
/** Wycinki parametrów Stripe, których używa atrapa klienta. */
interface PriceListParams {
  lookup_keys: Array<string>
}

interface CustomerParams {
  email: string
  metadata: Record<string, string>
}

interface PortalParams {
  customer: string
}

interface InvoiceListParams {
  customer: string
}

/** Faktura roczna Pro w formacie Stripe (kwota w centach, data w sekundach). */
const stripeInvoice = (customer: string) => ({
  id: `in_${customer}`,
  number: 'PH-0001',
  created: Date.UTC(2026, 10, 20) / 1000,
  total: 4900,
  currency: 'usd',
  status: 'paid',
  invoice_pdf: `https://pay.stripe.com/invoice/${customer}/pdf`,
  hosted_invoice_url: `https://invoice.stripe.com/i/${customer}`,
})

/** Ceny Pro w Stripe: nowe (miesięczna i roczna) i stara roczna sprzed zmiany cennika. */
const PRICES = {
  month: {
    id: 'price_pro_monthly',
    lookup_key: 'timeblame_pro_monthly',
    recurring: { interval: 'month' },
  },
  year: {
    id: 'price_pro_yearly',
    lookup_key: 'timeblame_pro_yearly',
    recurring: { interval: 'year' },
  },
  legacy: { id: 'price_legacy_yearly', lookup_key: 'splits_pro_yearly' },
}

let count = 0
const nextYear = Math.floor(Date.now() / 1000) + 365 * 86_400

const fake = {
  webhooks: real.webhooks,
  invoices: {
    list: async ({ customer }: InvoiceListParams) => ({
      data: [stripeInvoice(customer)],
    }),
  },
  prices: {
    list: async ({ lookup_keys }: PriceListParams) => ({
      data: Object.values(PRICES).filter(
        (price) => price.lookup_key && lookup_keys.includes(price.lookup_key),
      ),
    }),
  },
  customers: {
    create: async (params: CustomerParams) => {
      const customer = { id: `cus_${++count}`, ...params }
      state.customers.push(customer)
      return customer
    },
  },
  checkout: {
    sessions: {
      create: async (params: Record<string, unknown>) => {
        state.checkoutParams.push(params)
        const id = `cs_test_${++count}`
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
      const subscription = state.subscriptions.get(id)
      if (!subscription) throw new Error('No such subscription')
      return subscription
    },
    cancel: async (id: string) => {
      state.canceled.push(id)
      const subscription = state.subscriptions.get(id)
      if (!subscription) return { id, status: 'canceled' }
      const ended = { ...subscription, status: 'canceled' }
      state.subscriptions.set(id, ended)
      return ended
    },
  },
  billingPortal: {
    sessions: {
      create: async ({ customer }: PortalParams) => ({
        url: `https://billing.stripe.com/p/session/${customer}`,
      }),
    },
  },
}
setStripeClient(fake as unknown as Stripe)
afterAll(() => setStripeClient(null))

interface StripeEvent {
  id: string
  type: string
  data: { object: unknown }
}

/** Wysyła zdarzenie do webhooka z poprawnym (albo złym) podpisem Stripe-Signature. */
async function webhook(event: StripeEvent, secret = SECRET) {
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
    id: `sub_${++count}`,
    customer,
    status: 'active',
    metadata: { userId, plan: 'pro' },
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        {
          price: PRICES.year,
          quantity: 1,
          current_period_end: nextYear,
        },
      ],
    },
    ...patch,
  }
}

interface Billing {
  enabled: boolean
  plan: string
  subscription: null | {
    status: string
    interval: 'month' | 'year' | null
    active: boolean
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
}

/** Konto po zakupie Pro: koszyk → Checkout → webhook checkout.session.completed. */
async function buyPro(
  price: Sub['items']['data'][number]['price'] = PRICES.year,
) {
  const { apiClient } = await registered()
  const me = await apiClient.get<{ id: string }>('/account')
  const checkout = await apiClient.post<{ url: string }>('/billing/checkout', {
    plan: 'pro',
  })
  const sessionId = /cs_test_\d+/.exec(checkout.body.url)![0]
  const customer = state.customers.at(-1)!.id
  const subscription = makeSub(me.body.id, customer, {
    items: {
      data: [{ price, quantity: 1, current_period_end: nextYear }],
    },
  })
  state.subscriptions.set(subscription.id, subscription)
  state.sessions.set(sessionId, {
    client_reference_id: me.body.id,
    subscription: subscription.id,
    payment_status: 'paid',
  })
  const response = await webhook({
    id: `evt_${++count}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        mode: 'subscription',
        client_reference_id: me.body.id,
        subscription: subscription.id,
        customer,
      },
    },
  })
  expect(response.status).toBe(200)
  return {
    apiClient,
    userId: me.body.id,
    sub: subscription,
    sessionId,
    customer,
  }
}

beforeEach(() => {
  state.checkoutParams.length = 0
})

describe('billing (Stripe, Pro monthly or yearly)', () => {
  it('Should open a yearly Pro checkout for a free account', async () => {
    const { apiClient } = await registered()
    const me = await apiClient.get<{ id: string; email: string }>('/account')
    const status = await apiClient.get<Billing>('/billing')
    expect(status.body).toEqual({
      enabled: true,
      plan: 'free',
      subscription: null,
    })

    const response = await apiClient.post<{ url: string }>(
      '/billing/checkout',
      {
        plan: 'pro',
      },
    )
    expect(response.status).toBe(200)
    expect(response.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
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
    expect(params.cancel_url).toContain(
      '/app/checkout?interval=year&canceled=1',
    )

    // Drugie podejście używa tego samego klienta Stripe.
    const customers = state.customers.length
    await apiClient.post('/billing/checkout', { plan: 'pro' })
    expect(state.customers.length).toBe(customers)
    expect(state.checkoutParams[1]!.customer).toBe(params.customer)
    expect(state.customers.at(-1)!.email).toBe(me.body.email)
  })

  it('Should open a monthly Pro checkout with the monthly price', async () => {
    const { apiClient } = await registered()
    const before = state.checkoutParams.length
    const response = await apiClient.post<{ url: string }>(
      '/billing/checkout',
      {
        plan: 'pro',
        interval: 'month',
      },
    )
    expect(response.status).toBe(200)
    const params = state.checkoutParams[before]!
    expect(params).toMatchObject({
      line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
      metadata: expect.objectContaining({ interval: 'month' }),
    })
    expect(params.cancel_url).toContain(
      '/app/checkout?interval=month&canceled=1',
    )
  })

  it.each<[string, Record<string, unknown>]>([
    ['lifetime', { plan: 'lifetime' }],
    ['team', { plan: 'team' }],
    ['weekly Pro', { plan: 'pro', interval: 'week' }],
  ])('Should reject %s at checkout', async (_unused, body) => {
    const { apiClient } = await registered()
    expect((await apiClient.post('/billing/checkout', body)).status).toBe(400)
  })

  it('Should turn Pro on from a signed webhook and process each event once', async () => {
    const { apiClient, sub: subscription } = await buyPro()
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'pro',
    )
    const status = await apiClient.get<Billing>('/billing')
    expect(status.body.subscription).toMatchObject({
      status: 'active',
      interval: 'year',
      active: true,
      cancelAtPeriodEnd: false,
    })
    expect(
      new Date(status.body.subscription!.currentPeriodEnd!).getTime(),
    ).toBe(nextYear * 1000)
    expect(
      (
        await apiClient.post<{ code: string }>('/billing/checkout', {
          plan: 'pro',
        })
      ).body.code,
    ).toBe('billing.already_subscribed')

    const event = {
      id: `evt_${++count}`,
      type: 'customer.subscription.updated',
      data: { object: { id: subscription.id, object: 'subscription' } },
    }
    state.subscriptions.set(subscription.id, {
      ...subscription,
      cancel_at_period_end: true,
    })
    expect((await webhook(event)).body).toEqual({ received: true })
    expect((await webhook(event)).body).toEqual({
      received: true,
      duplicate: true,
    })
    expect(
      (await apiClient.get<Billing>('/billing')).body.subscription
        ?.cancelAtPeriodEnd,
    ).toBe(true)
  })

  it.each<[string, Sub['items']['data'][number]['price'], 'month' | 'year']>([
    ['the monthly price', PRICES.month, 'month'],
    ['the old yearly price from before the new pricing', PRICES.legacy, 'year'],
  ])('Should turn Pro on for %s', async (_unused, price, interval) => {
    const { apiClient } = await buyPro(price)
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'pro',
    )
    expect(
      (await apiClient.get<Billing>('/billing')).body.subscription?.interval,
    ).toBe(interval)
  })

  it('Should reject webhooks with a wrong signature', async () => {
    const response = await webhook(
      {
        id: `evt_${++count}`,
        type: 'checkout.session.completed',
        data: { object: {} },
      },
      'whsec_someone_else',
    )
    expect(response.status).toBe(400)
    const unsigned = await client().post('/stripe/webhook', { id: 'evt_x' })
    expect(unsigned.status).toBe(400)
  })

  it('Should go back to Free when the subscription ends', async () => {
    const { apiClient, sub: subscription } = await buyPro()
    state.subscriptions.set(subscription.id, { ...subscription, status: 'canceled' })
    await webhook({
      id: `evt_${++count}`,
      type: 'customer.subscription.deleted',
      data: { object: { id: subscription.id, object: 'subscription' } },
    })
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'free',
    )
    expect(
      (await apiClient.get<Billing>('/billing')).body.subscription?.active,
    ).toBe(false)
  })

  it('Should keep Pro during a payment retry (past_due)', async () => {
    const { apiClient, sub: subscription } = await buyPro()
    state.subscriptions.set(subscription.id, { ...subscription, status: 'past_due' })
    await webhook({
      id: `evt_${++count}`,
      type: 'customer.subscription.updated',
      data: { object: { id: subscription.id, object: 'subscription' } },
    })
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'pro',
    )
    expect(
      (await apiClient.get<Billing>('/billing')).body.subscription?.status,
    ).toBe('past_due')
  })

  it('Should sync right after returning from checkout, only for the owner', async () => {
    const { apiClient } = await registered()
    const me = await apiClient.get<{ id: string }>('/account')
    const checkout = await apiClient.post<{ url: string }>(
      '/billing/checkout',
      {
        plan: 'pro',
      },
    )
    const sessionId = /cs_test_\d+/.exec(checkout.body.url)![0]
    const subscription = makeSub(me.body.id, state.customers.at(-1)!.id)
    state.subscriptions.set(subscription.id, subscription)
    state.sessions.set(sessionId, {
      client_reference_id: me.body.id,
      subscription: subscription.id,
      payment_status: 'paid',
    })

    const other = (await registered()).apiClient
    expect((await other.post('/billing/sync', { sessionId })).status).toBe(404)
    const synced = await apiClient.post<{ plan: string; paid: boolean }>(
      '/billing/sync',
      { sessionId },
    )
    expect(synced.body).toEqual({ plan: 'pro', paid: true })
  })

  it('Should open the customer portal and cancel billing when the account is deleted', async () => {
    const { apiClient, sub: subscription, customer } = await buyPro()
    const me = await apiClient.get<{ email: string }>('/account')
    const portal = await apiClient.post<{ url: string }>('/billing/portal')
    expect(portal.body.url).toBe(
      `https://billing.stripe.com/p/session/${customer}`,
    )
    await apiClient.post('/account/delete-code')
    await apiClient.del('/account', { code: lastDeleteCode(me.body.email) })
    expect(state.canceled).toContain(subscription.id)
  })

  it('Should end Pro and the subscription after a full refund, not a partial one', async () => {
    const { apiClient, sub: subscription, customer } = await buyPro()
    const charge = (refunded: boolean) => ({
      id: `evt_${++count}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_${count}`,
          object: 'charge',
          customer,
          refunded,
          amount: 2400,
          amount_refunded: refunded ? 2400 : 500,
        },
      },
    })

    expect((await webhook(charge(false))).status).toBe(200)
    expect(state.canceled).not.toContain(subscription.id)
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'pro',
    )

    expect((await webhook(charge(true))).status).toBe(200)
    expect(state.canceled).toContain(subscription.id)
    expect((await apiClient.get<{ plan: string }>('/account')).body.plan).toBe(
      'free',
    )
    expect(
      (await apiClient.get<Billing>('/billing')).body.subscription,
    ).toMatchObject({
      status: 'canceled',
      active: false,
    })
  })

  it('Should record each payment and its refunds for the revenue numbers', async () => {
    const { apiClient, customer } = await buyPro()
    const me = await apiClient.get<{ id: string }>('/account')
    const chargeId = `ch_revenue_${++count}`
    const charge = (type: string, refunded: number) => ({
      id: `evt_${++count}`,
      type,
      data: {
        object: {
          id: chargeId,
          object: 'charge',
          customer,
          status: 'succeeded',
          refunded: false,
          amount: 4900,
          amount_refunded: refunded,
          currency: 'usd',
          created: Date.UTC(2026, 10, 20) / 1000,
        },
      },
    })
    await webhook(charge('charge.succeeded', 0))
    await webhook(charge('charge.refunded', 1000))
    const [row] = await database
      .select()
      .from(payments)
      .where(eq(payments.id, chargeId))
    expect(row).toMatchObject({
      userId: me.body.id,
      stripeCustomerId: customer,
      amount: 4900,
      amountRefunded: 1000,
      currency: 'usd',
      paidAt: new Date(Date.UTC(2026, 10, 20)),
    })
  })

  it('Should limit Free reports to the last 30 days on the server', async () => {
    const { apiClient, email } = await registered()
    const types = await apiClient.get<Array<{ id: string }>>('/task-types')
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
    expect((await apiClient.post('/time-entries', entry(old))).status).toBe(403)
    await database
      .update(users)
      .set({ plan: 'pro' })
      .where(sql`lower(${users.email}) = ${email}`)
    await apiClient.post('/time-entries', entry(old))
    await database
      .update(users)
      .set({ plan: 'free' })
      .where(sql`lower(${users.email}) = ${email}`)
    await apiClient.post('/time-entries', entry(today))
    const range = await apiClient.get<Array<{ workDate: string }>>(
      `/time-entries?from=2000-01-01&to=${today}`,
    )
    expect(range.body.map((listedEntry) => listedEntry.workDate)).toEqual([
      today,
    ])
  })
})

describe('planForPrice', () => {
  it('Should keep Pro for an older price that lost its lookup key', () => {
    expect(
      planForPrice({
        id: 'price_old',
        lookup_key: null,
        metadata: { plan: 'pro' },
      }),
    ).toBe('pro')
    expect(planForPrice({ id: 'price_other', lookup_key: null })).toBeNull()
  })

  it('Should list the Stripe invoices of the customer with links to the files', async () => {
    const { apiClient, customer } = await buyPro()
    const invoices =
      await apiClient.get<Array<Record<string, unknown>>>('/billing/invoices')
    expect(invoices.body).toEqual([
      {
        id: `in_${customer}`,
        number: 'PH-0001',
        date: '2026-11-20T00:00:00.000Z',
        total: 4900,
        currency: 'usd',
        status: 'paid',
        pdfUrl: `https://pay.stripe.com/invoice/${customer}/pdf`,
        url: `https://invoice.stripe.com/i/${customer}`,
      },
    ])
  })

  it('Should return no invoices for an account that never paid', async () => {
    const { apiClient } = await registered()
    expect((await apiClient.get('/billing/invoices')).body).toEqual([])
  })
})
