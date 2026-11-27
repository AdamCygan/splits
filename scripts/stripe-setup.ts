/**
 * Jednorazowa konfiguracja Stripe dla Timeblame (można uruchamiać wielokrotnie):
 *   STRIPE_SECRET_KEY=sk_test_… APP_URL=https://timeblame.com pnpm stripe:setup
 *
 * Tworzy albo aktualizuje:
 *  - produkt „Timeblame Pro” (opis, ikona, kategoria podatkowa SaaS, nazwa na wyciągu z karty),
 *  - dwie ceny o tych samych funkcjach: 6 USD miesięcznie i 60 USD rocznie (VAT wliczony),
 *    lookup keys timeblame_pro_monthly i timeblame_pro_yearly,
 *  - wyłącza dawną cenę 24 USD rocznie (obecni subskrybenci zostają na niej),
 *  - Customer Portal: faktury, karta, dane do faktury, zmiana miesięczny ↔ roczny, anulowanie
 *    na koniec opłaconego okresu,
 *  - endpoint webhooka {APP_URL}/api/v1/stripe/webhook (tylko dla adresu https) i wypisuje jego sekret.
 */
import Stripe from 'stripe'
import { PRO_PRICES } from '../src/features/billing/domain/plans'
import type { BillingInterval } from '../src/features/billing/domain/plans'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Ustaw STRIPE_SECRET_KEY (sk_test_… albo sk_live_…).')
  process.exit(1)
}
const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')
const stripe = new Stripe(key)

const PRODUCT = {
  name: 'Timeblame Pro',
  description:
    'Full history, sprint analytics, CSV export, unlimited work types, projects and templates, and daily reminders.',
  /** Software as a Service (SaaS) - business use. */
  taxCode: 'txcd_10103001',
  /** Tekst na wyciągu z karty (do 22 znaków): klient od razu wie, za co zapłacił. */
  statementDescriptor: 'TIMEBLAME',
  metadata: { app: 'timeblame', plan: 'pro' },
}

const LOOKUP_KEYS: Record<BillingInterval, string> = {
  month: 'timeblame_pro_monthly',
  year: 'timeblame_pro_yearly',
}
const LEGACY_LOOKUP_KEYS = ['splits_pro_yearly']
const NICKNAMES: Record<BillingInterval, string> = {
  month: 'Pro monthly',
  year: 'Pro yearly',
}

const productOf = (price: Stripe.Price) =>
  typeof price.product === 'string' ? price.product : price.product.id

async function findPrice(lookupKey: string) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
  return list.data[0] ?? null
}

/** Produkt Pro: istniejący (z ceny Timeblame albo dawnej ceny rocznej) albo nowy. */
async function ensureProduct() {
  const known = [...Object.values(LOOKUP_KEYS), ...LEGACY_LOOKUP_KEYS]
  let productId: string | null = null
  for (const lookupKey of known) {
    const price = await findPrice(lookupKey)
    if (price) {
      productId = productOf(price)
      break
    }
  }
  const details = {
    name: PRODUCT.name,
    description: PRODUCT.description,
    tax_code: PRODUCT.taxCode,
    statement_descriptor: PRODUCT.statementDescriptor,
    metadata: PRODUCT.metadata,
    // Stripe pobiera obrazek z publicznego adresu, więc tylko dla wdrożonej strony.
    ...(appUrl.startsWith('https://')
      ? { images: [`${appUrl}/icon-maskable-512.png`] }
      : {}),
  }
  if (productId) {
    await stripe.products.update(productId, details)
    console.log(`✓ Zaktualizowano produkt ${productId} (${PRODUCT.name})`)
    return productId
  }
  const created = await stripe.products.create(details)
  console.log(`✓ Utworzono produkt ${created.id} (${PRODUCT.name})`)
  return created.id
}

const usd = (cents: number, interval: BillingInterval) =>
  `${(cents / 100).toFixed(0)} USD / ${interval === 'month' ? 'miesiąc' : 'rok'}`

async function ensurePrice(productId: string, interval: BillingInterval) {
  const lookupKey = LOOKUP_KEYS[interval]
  const amount = PRO_PRICES[interval] * 100
  const current = await findPrice(lookupKey)
  if (
    current?.active &&
    current.unit_amount === amount &&
    current.tax_behavior === 'inclusive' &&
    productOf(current) === productId
  ) {
    console.log(
      `✓ Cena ${lookupKey} już jest: ${current.id} (${usd(amount, interval)})`,
    )
    return current
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval },
    // Cena dla klienta jest końcowa: VAT (jeśli dotyczy) jest w niej zawarty.
    tax_behavior: 'inclusive',
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    nickname: NICKNAMES[interval],
    metadata: { ...PRODUCT.metadata, interval },
  })
  if (current) {
    // Cen w Stripe nie da się edytować: dotychczasowa zostaje dla obecnych subskrypcji
    // (metadata.plan nadal wskazuje Pro), ale znika z nowych zakupów.
    await stripe.prices.update(current.id, {
      active: false,
      metadata: { ...current.metadata, plan: 'pro' },
    })
    console.log(
      `✓ Nowa cena ${price.id} (${usd(amount, interval)}) zastąpiła ${current.id}; obecni subskrybenci zostają na starej.`,
    )
  } else {
    console.log(`✓ Utworzono cenę ${price.id} (${usd(amount, interval)})`)
  }
  return price
}

/** Dawna cena 24 USD rocznie: nie do kupienia, ale obecne subskrypcje działają dalej. */
async function retireLegacyPrices() {
  for (const lookupKey of LEGACY_LOOKUP_KEYS) {
    const price = await findPrice(lookupKey)
    if (!price?.active) continue
    await stripe.prices.update(price.id, {
      active: false,
      metadata: { ...price.metadata, plan: 'pro' },
    })
    console.log(
      `✓ Wyłączono dawną cenę ${lookupKey} (${price.id}); obecni subskrybenci ją zachowują.`,
    )
  }
}

const WEBHOOK_EVENTS: Array<Stripe.WebhookEndpointCreateParams.EnabledEvent> = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  // Wpłaty do przychodu w panelu admina (kwota zapłacona minus zwroty).
  'charge.succeeded',
  // Pełny zwrot kończy subskrypcję (14 dni na zwrot z regulaminu); zwroty też zmniejszają przychód.
  'charge.refunded',
]

async function ensurePortal(
  productId: string,
  prices: ReadonlyArray<Stripe.Price>,
) {
  const configs = await stripe.billingPortal.configurations.list({ limit: 10 })
  const ours = configs.data.find(
    (c) => c.metadata?.app === 'timeblame' || c.metadata?.app === 'splits',
  )
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: 'Timeblame: manage your plan',
      ...(appUrl.startsWith('https://')
        ? {
            privacy_policy_url: `${appUrl}/privacy`,
            terms_of_service_url: `${appUrl}/terms`,
          }
        : {}),
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: {
        enabled: true,
        allowed_updates: ['address', 'name', 'tax_id', 'email'],
      },
      // Wyłączenie odnowienia działa na koniec opłaconego okresu (dostęp zostaje do jego końca).
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      // Zmiana miesięczny ↔ roczny: te same funkcje, inna płatność; różnica rozliczana proporcjonalnie.
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [{ product: productId, prices: prices.map((p) => p.id) }],
      },
    },
    default_return_url: appUrl ? `${appUrl}/app/settings/plan` : undefined,
    metadata: { app: 'timeblame' },
  }
  if (ours) {
    await stripe.billingPortal.configurations.update(ours.id, {
      business_profile: params.business_profile,
      features: params.features,
      default_return_url: params.default_return_url,
      metadata: params.metadata,
    })
    console.log(`✓ Zaktualizowano Customer Portal ${ours.id}`)
  } else {
    const created = await stripe.billingPortal.configurations.create({
      ...params,
      // Domyślna konfiguracja konta jest używana, gdy sesja nie wskazuje innej.
    })
    console.log(`✓ Utworzono Customer Portal ${created.id}`)
    console.log(
      '  Ustaw go jako domyślny: Stripe Dashboard → Settings → Billing → Customer portal.',
    )
  }
}

async function ensureWebhook() {
  if (!appUrl.startsWith('https://')) {
    console.log(
      '• Webhook pominięty (APP_URL nie jest https). Lokalnie użyj Stripe CLI:\n' +
        '  stripe listen --forward-to localhost:3000/api/v1/stripe/webhook',
    )
    return
  }
  const url = `${appUrl}/api/v1/stripe/webhook`
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const existing = endpoints.data.find((e) => e.url === url)
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: WEBHOOK_EVENTS,
    })
    console.log(
      `✓ Webhook ${url} już jest (${existing.id}). Sekret: Dashboard → Developers → Webhooks.`,
    )
    return
  }
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Timeblame: subscriptions',
  })
  console.log(`✓ Utworzono webhook ${url}`)
  console.log(`  STRIPE_WEBHOOK_SECRET=${created.secret}`)
  console.log(
    '  Zapisz go jako sekret aplikacji, np.: fly secrets set STRIPE_WEBHOOK_SECRET=…',
  )
}

const productId = await ensureProduct()
const prices = [
  await ensurePrice(productId, 'month'),
  await ensurePrice(productId, 'year'),
]
await retireLegacyPrices()
await ensurePortal(productId, prices)
await ensureWebhook()
console.log('\nGotowe. W panelu Stripe ustaw jeszcze:')
console.log(
  ' • Settings → Business → Public details: nazwa Timeblame, opis na wyciągu TIMEBLAME, adres strony i e-mail wsparcia,',
)
console.log(
  ' • Settings → Branding: ikona (public/icon-maskable-512.png), logo, kolor marki #3D3BF3 i akcent #14162B,',
)
console.log(
  ' • Settings → Billing → Invoices: prefiks numerów faktur (np. TB) i dane firmy w stopce,',
)
console.log(
  ' • Settings → Billing → Subscriptions and emails: przypomnienie o odnowieniu (7 dni) i e-maile z fakturą,',
)
console.log(
  ' • Settings → Tax (Stripe Tax), jeśli chcesz, żeby Stripe liczył VAT; wtedy STRIPE_AUTOMATIC_TAX=true.',
)
