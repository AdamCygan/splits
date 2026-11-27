import Stripe from 'stripe'
import { serverEnv } from '../env'
import { ApiError } from '../http/errors'
import { isBillingInterval } from '#/features/billing/domain/plans'
import type { BillingInterval } from '#/features/billing/domain/plans'

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
    appInfo: { name: 'Timeblame' },
  })
  return client
}

/** Tylko testy: fałszywy klient (np. bez sieci). null przywraca prawdziwy. */
export function setStripeClient(fake: Stripe | null) {
  client = fake
}

export const billingEnabled = () => serverEnv.stripe !== null || client !== null

/** Ceny w Stripe mają stałe lookup key, więc w kodzie nie trzeba trzymać id cen (price_…). */
export const PRICE_LOOKUP_KEYS: Readonly<Record<BillingInterval, string>> = {
  month: 'timeblame_pro_monthly',
  year: 'timeblame_pro_yearly',
}
/** Dawna cena roczna (24 USD): obecni subskrybenci zostają na niej z pełnym Pro. */
const LEGACY_PRO_KEYS = ['splits_pro_yearly']

const priceCache = new Map<BillingInterval, { id: string; at: number }>()

const priceOverride = (interval: BillingInterval) =>
  interval === 'month'
    ? serverEnv.stripe?.priceProMonthly
    : serverEnv.stripe?.priceProYearly

/** Id aktualnej ceny Pro dla interwału (zmienna STRIPE_PRICE_PRO_* albo lookup key, cache 10 min). */
export async function priceFor(interval: BillingInterval): Promise<string> {
  const override = priceOverride(interval)
  if (override) return override
  const cached = priceCache.get(interval)
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.id
  const prices = await stripe()
    .prices.list({
      lookup_keys: [PRICE_LOOKUP_KEYS[interval]],
      active: true,
      limit: 1,
    })
    .catch(() => {
      throw new ApiError('billing.failed', 502)
    })
  const price = prices.data[0]
  if (!price) throw new ApiError('billing.unavailable', 503)
  priceCache.set(interval, { id: price.id, at: Date.now() })
  return price.id
}

type PriceInfo = Pick<Stripe.Price, 'id' | 'lookup_key'> & {
  metadata?: Stripe.Metadata | null
  recurring?: Pick<Stripe.Price.Recurring, 'interval'> | null
}

/**
 * Plan wynikający z ceny subskrypcji: lookup key (obecny albo dawny), metadata.plan (starsze ceny
 * po zmianie kwoty tracą lookup key, ale zachowują metadane) albo id z konfiguracji.
 */
export function planForPrice(price: PriceInfo) {
  const keys = [...Object.values(PRICE_LOOKUP_KEYS), ...LEGACY_PRO_KEYS]
  if (price.lookup_key && keys.includes(price.lookup_key)) return 'pro' as const
  if (price.metadata?.plan === 'pro') return 'pro' as const
  const overrides = [
    serverEnv.stripe?.priceProMonthly,
    serverEnv.stripe?.priceProYearly,
  ]
  if (overrides.includes(price.id)) return 'pro' as const
  return null
}

/** Interwał płatności ceny (miesięczny albo roczny); inne interwały nie występują. */
export function intervalOfPrice(price: PriceInfo): BillingInterval | null {
  const interval = price.recurring?.interval
  if (isBillingInterval(interval)) return interval
  // Bez danych o okresie: rozpoznaj po lookup key (stare ceny były tylko roczne).
  if (price.lookup_key === PRICE_LOOKUP_KEYS.month) return 'month'
  if (
    price.lookup_key === PRICE_LOOKUP_KEYS.year ||
    LEGACY_PRO_KEYS.includes(price.lookup_key ?? '')
  )
    return 'year'
  return null
}
