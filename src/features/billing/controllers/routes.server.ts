import { handleStripeEvent } from '../data/repository.server'
import { serverEnv } from '#/server/env'
import { stripe } from '../data/stripe.server'
import type Stripe from 'stripe'
import {
  getBillingStatus,
  getInvoices,
  openCheckout,
  syncCheckout,
  openPortal,
  checkoutInput,
  syncInput,
} from '../data/repository.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { currentUser } from '#/features/account/data/repository.server'

export const billingRoutes = new Hono<AppEnv>()
  /** Stan planu i subskrypcji do strony „Plan” i koszyka. */
  .get('/', async (c) => {
    const user = await currentUser(c.get('userId'))
    return c.json(await getBillingStatus(user))
  })

  /** Faktury i paragony ze Stripe (ostatnie 24), z linkami do PDF i strony płatności. */
  .get('/invoices', async (c) => {
    const user = await currentUser(c.get('userId'))
    return c.json(await getInvoices(user))
  })

  /** Koszyk → Stripe Checkout: subskrypcja Pro płatna z góry za miesiąc albo za rok. */
  .post('/checkout', async (c) => {
    const user = await currentUser(c.get('userId'))
    // Płatność tylko z potwierdzonym adresem: na niego idą faktury i e-maile o odnowieniu.
    if (!user.emailVerifiedAt && !user.isDemo)
      throw new ApiError('auth.email_unverified', 403)
    const { plan, interval } = await body(c, checkoutInput)
    return c.json(await openCheckout(user, plan, interval))
  })

  /**
   * Po powrocie z płatności: synchronizacja od razu (webhook bywa o kilka sekund wolniejszy).
   * Sesja musi należeć do zalogowanego użytkownika.
   */
  .post('/sync', async (c) => {
    const userId = c.get('userId')
    const { sessionId } = await body(c, syncInput)
    return c.json(await syncCheckout(userId, sessionId))
  })

  /** Stripe Customer Portal: faktury, karta, anulowanie na koniec okresu. */
  .post('/portal', async (c) => {
    const user = await currentUser(c.get('userId'))
    return c.json(await openPortal(user))
  })

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

    const handled = await handleStripeEvent(event)
    return c.json(
      handled ? { received: true } : { received: true, duplicate: true },
    )
  },
)
