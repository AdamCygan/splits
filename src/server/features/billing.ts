import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type Stripe from 'stripe'
import { z } from 'zod'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import {
  payments,
  stripeEvents,
  subscriptions,
  userSettings,
  users,
} from '../db/schema'
import { serverEnv } from '../env'
import {
  billingEnabled,
  intervalOfPrice,
  planForPrice,
  priceFor,
  stripe,
} from '../billing/stripe'
import { BILLING_INTERVALS } from '#/features/billing/plans'
import type { AppEnv } from '../http/context'
import { ApiError } from '../http/errors'
import { body } from '../http/inputs'
import { assertNotDemo, currentUser } from './account'

/** Statusy, przy których plan działa (past_due: Stripe ponawia płatność, dajemy czas). */
const ACTIVE = ['active', 'trialing', 'past_due'] as const
const isActive = (status: string) =>
  (ACTIVE as ReadonlyArray<string>).includes(status)

/** Kopia subskrypcji ze Stripe w bazie + przeliczenie planu użytkownika. */
export async function syncSubscription(
  tx: Tx,
  sub: Stripe.Subscription,
  knownUserId?: string | null,
) {
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  let userId = knownUserId ?? sub.metadata.userId ?? null
  if (!userId) {
    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
    userId = owner?.id ?? null
  }
  if (!userId) return null
  const [owner] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
  if (!owner) return null

  const item = sub.items.data[0]
  const plan = item ? planForPrice(item.price) : null
  if (!item || !plan) return null
  const values = {
    userId,
    stripeCustomerId: customerId,
    status: sub.status,
    plan,
    priceId: item.price.id,
    interval: intervalOfPrice(item.price),
    quantity: item.quantity ?? 1,
    currentPeriodEnd: item.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
  }
  await tx
    .insert(subscriptions)
    .values({ id: sub.id, ...values })
    .onConflictDoUpdate({ target: subscriptions.id, set: values })
  await tx
    .update(users)
    .set({ stripeCustomerId: customerId })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)))
  await recomputePlan(tx, userId)
  return userId
}

/** Plan = najlepsza aktywna subskrypcja; Lifetime (dawne zakupy) zostaje na zawsze. */
async function recomputePlan(tx: Tx, userId: string) {
  const [user] = await tx
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
  if (!user || user.plan === 'lifetime') return
  const active = await tx
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...ACTIVE]),
      ),
    )
  const plan = active.some((s) => s.plan === 'pro') ? 'pro' : 'free'
  if (plan !== user.plan)
    await tx.update(users).set({ plan }).where(eq(users.id, userId))
}

async function latestSubscription(userId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1)
  return row ?? null
}

/** Klient Stripe dla konta: tworzony raz, z e-mailem i id użytkownika w metadanych. */
async function customerFor(user: typeof users.$inferSelect) {
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe()
    .customers.create({
      email: user.email,
      name: user.displayName,
      metadata: { userId: user.id },
    })
    .catch(() => {
      throw new ApiError('billing.failed', 502)
    })
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, user.id))
  return customer.id
}

const checkoutInput = z.object({
  plan: z.enum(['pro']),
  /** Co miesiąc albo raz w roku; te same funkcje, inna płatność. Starsze klienty: rok. */
  interval: z.enum(BILLING_INTERVALS).default('year'),
})
const syncInput = z.object({ sessionId: z.string().regex(/^cs_[\w]+$/) })

export const billingRoutes = new Hono<AppEnv>()
  /** Stan planu i subskrypcji do strony „Plan” i koszyka. */
  .get('/', async (c) => {
    const user = await currentUser(c.get('userId'))
    const sub = await latestSubscription(user.id)
    return c.json({
      enabled: billingEnabled(),
      plan: user.plan,
      subscription: sub
        ? {
            status: sub.status,
            plan: sub.plan,
            interval: sub.interval,
            active: isActive(sub.status),
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
    })
  })

  /** Faktury i paragony ze Stripe (ostatnie 24), z linkami do PDF i strony płatności. */
  .get('/invoices', async (c) => {
    const user = await currentUser(c.get('userId'))
    return c.json(await listInvoices(user.stripeCustomerId))
  })

  /** Koszyk → Stripe Checkout: subskrypcja Pro płatna z góry za miesiąc albo za rok. */
  .post('/checkout', async (c) => {
    const user = await currentUser(c.get('userId'))
    // Płatność tylko z potwierdzonym adresem: na niego idą faktury i e-maile o odnowieniu.
    if (!user.emailVerifiedAt && !user.isDemo)
      throw new ApiError('auth.email_unverified', 403)
    const { plan, interval } = await body(c, checkoutInput)
    assertNotDemo(user)
    if (!billingEnabled()) throw new ApiError('billing.unavailable', 503)
    // Administrator ma Pro bez opłat, a Lifetime na zawsze: kupowanie nie ma sensu.
    if (user.plan === 'lifetime' || user.plan === plan || user.role === 'admin')
      throw new ApiError('billing.already_subscribed', 409)
    const sub = await latestSubscription(user.id)
    if (sub && isActive(sub.status) && sub.plan === plan)
      throw new ApiError('billing.already_subscribed', 409)

    const [settings] = await db
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
    // Zmiana miesięczny ↔ roczny przy aktywnej subskrypcji idzie przez Customer Portal.
    const price = await priceFor(interval)
    const customer = await customerFor(user)
    const session = await stripe()
      .checkout.sessions.create({
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        line_items: [{ price, quantity: 1 }],
        metadata: { userId: user.id, plan, interval },
        subscription_data: { metadata: { userId: user.id, plan, interval } },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        automatic_tax: { enabled: serverEnv.stripe?.automaticTax ?? false },
        locale: settings?.locale === 'pl' ? 'pl' : 'en',
        success_url: `${serverEnv.appUrl}/app/settings/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${serverEnv.appUrl}/app/checkout?interval=${interval}&canceled=1`,
      })
      .catch((error: unknown) => {
        console.error('[billing] checkout', error)
        throw new ApiError('billing.failed', 502)
      })
    if (!session.url) throw new ApiError('billing.failed', 502)
    return c.json({ url: session.url })
  })

  /**
   * Po powrocie z płatności: synchronizacja od razu (webhook bywa o kilka sekund wolniejszy).
   * Sesja musi należeć do zalogowanego użytkownika.
   */
  .post('/sync', async (c) => {
    const userId = c.get('userId')
    const { sessionId } = await body(c, syncInput)
    const session = await stripe()
      .checkout.sessions.retrieve(sessionId)
      .catch(() => {
        throw new ApiError('billing.failed', 502)
      })
    if (session.client_reference_id !== userId)
      throw new ApiError('not_found', 404)
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id
    if (subId) {
      const sub = await stripe().subscriptions.retrieve(subId)
      await db.transaction((tx) => syncSubscription(tx, sub, userId))
    }
    const user = await currentUser(userId)
    return c.json({ plan: user.plan, paid: session.payment_status === 'paid' })
  })

  /** Stripe Customer Portal: faktury, karta, anulowanie na koniec okresu. */
  .post('/portal', async (c) => {
    const user = await currentUser(c.get('userId'))
    assertNotDemo(user)
    if (!user.stripeCustomerId) throw new ApiError('not_found', 404)
    const session = await stripe()
      .billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${serverEnv.appUrl}/app/settings/plan`,
      })
      .catch(() => {
        throw new ApiError('billing.failed', 502)
      })
    return c.json({ url: session.url })
  })

/** Faktury klienta Stripe (ostatnie 24); bez płatności albo bez klienta pusta lista. */
export async function listInvoices(customerId: string | null) {
  if (!billingEnabled() || !customerId) return []
  const list = await stripe()
    .invoices.list({ customer: customerId, limit: 24 })
    .catch((error: unknown) => {
      console.error('[billing] invoices', error)
      throw new ApiError('billing.failed', 502)
    })
  return list.data.map((i) => ({
    id: i.id,
    number: i.number ?? null,
    date: new Date(i.created * 1000).toISOString(),
    total: i.total,
    currency: i.currency,
    status: i.status ?? 'draft',
    pdfUrl: i.invoice_pdf ?? null,
    url: i.hosted_invoice_url ?? null,
  }))
}

/** Karta klienta w panelu Stripe (tryb testowy dla kluczy sk_test/rk_test). */
export function stripeCustomerUrl(customerId: string | null) {
  const key = serverEnv.stripe?.secretKey
  if (!key || !customerId) return null
  const test = /^(sk|rk)_test_/.test(key)
  return `https://dashboard.stripe.com/${test ? 'test/' : ''}customers/${customerId}`
}

/**
 * Wpłata do statystyk przychodu: zapłacona kwota i zwroty z obciążenia Stripe. To samo
 * obciążenie przychodzi przy zapłacie i przy każdym zwrocie, więc zapis jest idempotentny.
 */
export async function recordCharge(charge: Stripe.Charge) {
  if (charge.status !== 'succeeded') return
  const customerId =
    typeof charge.customer === 'string'
      ? charge.customer
      : (charge.customer?.id ?? null)
  const [owner] = customerId
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
    : []
  const values = {
    userId: owner?.id ?? null,
    stripeCustomerId: customerId,
    amount: charge.amount,
    amountRefunded: charge.amount_refunded,
    currency: charge.currency,
    paidAt: new Date(charge.created * 1000),
  }
  await db
    .insert(payments)
    .values({ id: charge.id, ...values })
    .onConflictDoUpdate({
      target: payments.id,
      set: { amountRefunded: values.amountRefunded, updatedAt: new Date() },
    })
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

/**
 * Pełny zwrot (np. w ramach 14 dni) kończy subskrypcję od razu: bez tego klient po zwrocie
 * nadal miałby Pro, a za rok Stripe obciążyłby go ponownie. Częściowy zwrot (rabat, gest
 * dobrej woli) niczego nie zmienia.
 */
async function endAfterRefund(charge: Stripe.Charge) {
  if (!charge.refunded || !charge.customer) return
  const customerId =
    typeof charge.customer === 'string' ? charge.customer : charge.customer.id
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.stripeCustomerId, customerId),
        inArray(subscriptions.status, [...ACTIVE]),
      ),
    )
  for (const { id } of rows) {
    const current = await stripe().subscriptions.retrieve(id)
    const ended =
      current.status === 'canceled'
        ? current
        : await stripe().subscriptions.cancel(id, {
            cancellation_details: { comment: `Refund ${charge.id}` },
          })
    await db.transaction((tx) => syncSubscription(tx, ended))
  }
}

/**
 * Webhook Stripe (bez logowania, z podpisem). Każde zdarzenie obsługujemy raz (tabela stripe_events),
 * a subskrypcję zawsze pobieramy świeżą ze Stripe, więc kolejność zdarzeń nie ma znaczenia.
 */
export const stripeWebhookRoutes = new Hono<AppEnv>().post(
  '/webhook',
  async (c) => {
    const secret = serverEnv.stripe?.webhookSecret
    const signature = c.req.header('stripe-signature')
    if (!secret || !signature) throw new ApiError('validation.invalid', 400)
    const payload = await c.req.text()
    let event: Stripe.Event
    try {
      event = await stripe().webhooks.constructEventAsync(
        payload,
        signature,
        secret,
      )
    } catch {
      throw new ApiError('validation.invalid', 400)
    }

    const fresh = await db
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id })
    if (fresh.length === 0) return c.json({ received: true, duplicate: true })

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        if (session.mode === 'subscription' && subId) {
          const sub = await stripe().subscriptions.retrieve(subId)
          await db.transaction((tx) =>
            syncSubscription(tx, sub, session.client_reference_id),
          )
        }
      } else if (event.type === 'charge.succeeded') {
        await recordCharge(event.data.object)
      } else if (event.type === 'charge.refunded') {
        await recordCharge(event.data.object)
        await endAfterRefund(event.data.object)
      } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const { id } = event.data.object as Stripe.Subscription
        const sub = await stripe().subscriptions.retrieve(id)
        await db.transaction((tx) => syncSubscription(tx, sub))
      }
    } catch (error) {
      // Zdarzenie nie zostało obsłużone: usuwamy znacznik, żeby ponowienie Stripe je przetworzyło.
      await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id))
      throw error
    }
    return c.json({ received: true })
  },
)

/** Przy usuwaniu konta: aktywne subskrypcje kończą się od razu (bez dalszych obciążeń). */
export async function cancelSubscriptionsFor(userId: string) {
  const rows = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
  for (const row of rows.filter((r) => r.status !== 'canceled'))
    await stripe()
      .subscriptions.cancel(row.id)
      .catch((error: unknown) =>
        console.error('[billing] cancel', row.id, error),
      )
}
