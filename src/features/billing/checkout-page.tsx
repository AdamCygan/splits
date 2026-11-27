import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Lock, ShieldCheck } from 'lucide-react'
import { FormAlert } from '#/components/form/form-field'
import { Button, buttonVariants } from '#/components/ui/button'
import { billingApi } from './data/api'
import { useCurrentUser } from '#/features/auth/session'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { billingMessages } from '#/i18n/messages/billing'
import { marketingMessages } from '#/i18n/messages/marketing'
import { cn } from '#/lib/utils'
import { Segmented } from '#/components/ui/segmented'
import {
  BILLING_INTERVALS,
  PRO_PRICES,
  formatPrice,
  planById,
  renewalDate,
} from './domain/plans'
import type { BillingInterval } from './domain/plans'
import { billingQuery, useStripeRedirect } from './queries'

export interface CheckoutPageProps {
  interval: BillingInterval
  canceled: boolean
  onIntervalChange: (interval: BillingInterval) => void
}

/**
 * Koszyk: Pro płatne co miesiąc albo co rok (te same funkcje), zgoda na regulamin
 * i przejście do Stripe Checkout. Kartę, adres, NIP i kod rabatowy podaje się już w Stripe.
 */
export function CheckoutPage({
  interval,
  canceled,
  onIntervalChange,
}: CheckoutPageProps) {
  const t = useMessages(billingMessages).checkout
  const features = useMessages(marketingMessages).pricing.features
  const { tag, locale } = useI18n()
  const billing = useQuery(billingQuery)
  const plan = planById('pro')
  const price = formatPrice(PRO_PRICES[interval], tag)
  const [accepted, setAccepted] = useState(false)
  const consentId = useId()
  const checkout = useStripeRedirect((next: BillingInterval) =>
    billingApi.checkout(next),
  )

  const status = billing.data
  const isAdmin = useCurrentUser()?.role === 'admin'
  const owned =
    isAdmin ||
    status?.plan === 'lifetime' ||
    status?.plan === 'pro' ||
    (status?.subscription?.active && status.subscription.plan === 'pro')

  const intervalOptions = BILLING_INTERVALS.map((value) => ({
    value,
    label: t.intervals[value],
    description:
      value === 'year'
        ? `${formatPrice(PRO_PRICES.year, tag)}, ${t.saveBadge}`
        : formatPrice(PRO_PRICES.month, tag),
  }))

  const renewal = formatDate(
    locale,
    renewalDate(interval).toISOString().slice(0, 10),
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  )

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/pricing"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t.back}
      </Link>
      <header className="mb-8">
        <h1 className="type-display text-4xl sm:text-5xl">{t.title}</h1>
        <p className="mt-2 text-ink-soft">{t.lead}</p>
      </header>

      {canceled && !owned && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-line bg-muted/50 px-4 py-3 text-sm"
        >
          {t.canceled}
        </p>
      )}

      {owned ? (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="type-heading text-2xl">{t.alreadyTitle}</h2>
          <p className="mt-2 text-ink-soft">{t.alreadyText}</p>
          <Link
            to="/app/settings/plan"
            className={cn(buttonVariants(), 'mt-5')}
          >
            {t.goToPlan}
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Pozycja w koszyku */}
          <section
            aria-labelledby="cart-item"
            className="rounded-2xl border border-line bg-surface p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="cart-item" className="type-heading text-2xl">
                  {fmt(t.item, { plan: plan.name })}
                </h2>
                <p className="mt-1 text-ink-soft">{t.itemPeriod[interval]}</p>
              </div>
              <p className="type-display text-3xl tabular-nums">{price}</p>
            </div>
            <Segmented
              className="mt-5"
              label={t.billing}
              name="billing-interval"
              value={interval}
              onChange={onIntervalChange}
              options={intervalOptions}
            />
            <h3 className="mt-6 text-sm font-semibold">{t.included}</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {features.pro.map((feature) => (
                <li key={feature} className="flex gap-2 text-[0.9375rem]">
                  <Check
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-wt-pair"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          {/* Podsumowanie i płatność */}
          <section
            aria-labelledby="cart-summary"
            className="rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-20"
          >
            <h2 id="cart-summary" className="type-heading text-xl">
              {t.summary}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>{fmt(t.line[interval], { plan: plan.name })}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
              <div className="flex justify-between gap-3 text-ink-soft">
                <dt>{t.vat}</dt>
                <dd>{t.vatValue}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-semibold">
                <dt>{t.total}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-ink-soft">
              {fmt(t.renews, { date: renewal, price })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{t.promo}</p>

            <div className="mt-5 flex gap-3">
              <input
                id={consentId}
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--ink-fixed)]"
              />
              <label htmlFor={consentId} className="text-sm">
                <Consent text={t.consent} terms={t.terms} privacy={t.privacy} />
              </label>
            </div>
            <p className="mt-3 flex gap-2 text-sm text-ink-soft">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.refund}
            </p>

            {status && !status.enabled && (
              <div className="mt-4">
                <FormAlert>{t.disabled}</FormAlert>
              </div>
            )}
            <Button
              size="lg"
              className="mt-5 h-12 w-full text-base"
              disabled={!accepted || !status?.enabled || checkout.isPending}
              aria-busy={checkout.isPending}
              onClick={() => checkout.mutate(interval)}
            >
              <Lock aria-hidden className="size-4" />
              {checkout.isPending ? t.redirecting : t.pay}
            </Button>
            <p className="mt-3 text-xs text-ink-soft">{t.secure}</p>
          </section>
        </div>
      )}
    </div>
  )
}

interface ConsentProps {
  text: string
  terms: string
  privacy: string
}

/** Zgoda z linkami do dokumentów (otwierają się w nowej karcie, koszyk zostaje). */
function Consent({ text, terms, privacy }: ConsentProps) {
  const link = (to: '/terms' | '/privacy', label: string) => (
    <a
      href={to}
      target="_blank"
      rel="noopener"
      className="font-medium underline underline-offset-4"
    >
      {label}
    </a>
  )
  const [before, rest = ''] = text.split('{terms}')
  const [middle, after = ''] = rest.split('{privacy}')
  return (
    <>
      {before}
      {link('/terms', terms)}
      {middle}
      {link('/privacy', privacy)}
      {after}
    </>
  )
}
