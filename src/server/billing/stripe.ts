import Stripe from 'stripe'
import { serverEnv } from '../env'
import { ApiError } from '../http/errors'

/**
 * Klient Stripe tworzony leniwie (bez klucza aplikacja działa, tylko bez płatności).
 * Testy podmieniają go na fałszywy przez setStripeClient().
 */
let client: Stripe | null = null

export function stripe(): Stripe {
  if (client) return client
  if (!serverEnv.stripe) throw new ApiError('billing.unavailable', 503)
  client = new Stripe(serverEnv.stripe.secretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'Splits' },
  })
  return client
}

/** Tylko testy: fałszywy klient (np. bez sieci). null przywraca prawdziwy. */
export function setStripeClient(fake: Stripe | null) {
  client = fake
}

export const billingEnabled = () => serverEnv.stripe !== null || client !== null

/** Ceny w Stripe mają stałe lookup key, więc w kodzie nie trzeba trzymać id cen (price_…). */
export const PRICE_LOOKUP_KEYS = { pro: 'splits_pro_yearly' } as const
export type PaidPlan = keyof typeof PRICE_LOOKUP_KEYS

const priceCache = new Map<PaidPlan, { id: string; at: number }>()

/** Id aktualnej ceny planu (STRIPE_PRICE_PRO_YEARLY albo wyszukanie po lookup key, cache 10 min). */
export async function priceFor(plan: PaidPlan): Promise<string> {
  // Jedyny płatny plan to Pro; przy kolejnych planach dojdą tu ich zmienne.
  const override = serverEnv.stripe?.priceProYearly
  if (override) return override
  const cached = priceCache.get(plan)
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.id
  const prices = await stripe()
    .prices.list({
      lookup_keys: [PRICE_LOOKUP_KEYS[plan]],
      active: true,
      limit: 1,
    })
    .catch(() => {
      throw new ApiError('billing.failed', 502)
    })
  const price = prices.data[0]
  if (!price) throw new ApiError('billing.unavailable', 503)
  priceCache.set(plan, { id: price.id, at: Date.now() })
  return price.id
}

/**
 * Plan wynikający z ceny subskrypcji: lookup key, metadata.plan (starsze ceny po zmianie kwoty
 * tracą lookup key, ale zachowują metadane) albo id z konfiguracji.
 */
export function planForPrice(
  price: Pick<Stripe.Price, 'id' | 'lookup_key'> & {
    metadata?: Stripe.Metadata | null
  },
) {
  if (price.lookup_key === PRICE_LOOKUP_KEYS.pro) return 'pro' as const
  if (price.metadata?.plan === 'pro') return 'pro' as const
  if (serverEnv.stripe?.priceProYearly === price.id) return 'pro' as const
  return null
}
