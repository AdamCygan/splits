/**
 * Jednorazowa konfiguracja Stripe dla Pointhours (można uruchamiać wielokrotnie):
 *   STRIPE_SECRET_KEY=sk_test_… APP_URL=https://pointhours.com pnpm stripe:setup
 *
 * Tworzy (albo zostawia istniejące):
 *  - produkt „Pointhours Pro” z ceną roczną 24 USD (VAT wliczony), lookup key splits_pro_yearly,
 *  - konfigurację Customer Portal: faktury, karta, dane do faktury, wyłączenie odnowienia na koniec roku,
 *  - endpoint webhooka {APP_URL}/api/v1/stripe/webhook (tylko dla adresu https) i wypisuje jego sekret.
 */
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Ustaw STRIPE_SECRET_KEY (sk_test_… albo sk_live_…).')
  process.exit(1)
}
const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')
const stripe = new Stripe(key)

const PRO = {
  lookupKey: 'splits_pro_yearly',
  amount: 2400,
  name: 'Pointhours Pro',
  description:
    'Full history, sprint analytics, CSV export and unlimited work types. Billed yearly.',
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

const usd = (cents: number) => `${(cents / 100).toFixed(0)} USD / rok`

async function ensurePrice() {
  const existing = await stripe.prices.list({
    lookup_keys: [PRO.lookupKey],
    limit: 1,
  })
  const current = existing.data[0]
  if (current?.unit_amount === PRO.amount) {
    console.log(`✓ Cena ${PRO.lookupKey} już jest: ${current.id}`)
    return current
  }

  const productId = current
    ? typeof current.product === 'string'
      ? current.product
      : current.product.id
    : (
        await stripe.products.create({
          name: PRO.name,
          description: PRO.description,
          metadata: { app: 'splits', plan: 'pro' },
        })
      ).id
  if (current) {
    // Cen w Stripe nie da się edytować: dotychczasowa zostaje dla obecnych subskrypcji
    // (metadata.plan nadal wskazuje Pro), ale znika z nowych zakupów.
    await stripe.prices.update(current.id, {
      active: false,
      metadata: { ...current.metadata, plan: 'pro' },
    })
    await stripe.products.update(productId, { description: PRO.description })
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: PRO.amount,
    recurring: { interval: 'year' },
    // Cena dla klienta jest końcowa: VAT (jeśli dotyczy) jest w niej zawarty.
    tax_behavior: 'inclusive',
    lookup_key: PRO.lookupKey,
    transfer_lookup_key: true,
    nickname: 'Pro yearly',
    metadata: { app: 'splits', plan: 'pro' },
  })
  console.log(
    current
      ? `✓ Nowa cena ${price.id} (${usd(PRO.amount)}) zastąpiła ${current.id} (${usd(current.unit_amount ?? 0)})`
      : `✓ Utworzono produkt ${productId} i cenę ${price.id} (${usd(PRO.amount)})`,
  )
  if (current)
    console.log(
      '  Obecni subskrybenci zostają na starej cenie. Żeby ich przenieść: Dashboard → Subscriptions → Update price.',
    )
  return price
}

async function ensurePortal(price: Stripe.Price) {
  const configs = await stripe.billingPortal.configurations.list({ limit: 10 })
  const ours = configs.data.find((c) => c.metadata?.app === 'splits')
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: 'Pointhours: manage your plan',
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
      // Wyłączenie odnowienia działa na koniec opłaconego roku (dostęp zostaje do końca okresu).
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: { enabled: false },
    },
    default_return_url: appUrl ? `${appUrl}/app/settings/plan` : undefined,
    metadata: { app: 'splits', price: price.id },
  }
  if (ours) {
    await stripe.billingPortal.configurations.update(ours.id, {
      business_profile: params.business_profile,
      features: params.features,
      default_return_url: params.default_return_url,
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
    description: 'Pointhours: subscriptions',
  })
  console.log(`✓ Utworzono webhook ${url}`)
  console.log(`  STRIPE_WEBHOOK_SECRET=${created.secret}`)
  console.log(
    '  Zapisz go jako sekret aplikacji, np.: fly secrets set STRIPE_WEBHOOK_SECRET=…',
  )
}

const price = await ensurePrice()
await ensurePortal(price)
await ensureWebhook()
console.log('\nGotowe. W panelu Stripe włącz jeszcze:')
console.log(
  ' • Settings → Billing → Subscriptions and emails: przypomnienie o odnowieniu (7 dni) i e-maile z fakturą,',
)
console.log(
  ' • Settings → Tax (Stripe Tax), jeśli chcesz, żeby Stripe liczył VAT; wtedy STRIPE_AUTOMATIC_TAX=true.',
)
