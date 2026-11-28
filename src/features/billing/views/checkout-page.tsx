import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Lock, ShieldCheck } from 'lucide-react'
import { FormAlert } from '#/components/form/form-field'
import { Button, buttonVariants } from '#/components/ui/button'
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
} from '../domain/plans'
import type { BillingInterval } from '../domain/plans'
import { useCheckout } from '../controllers/use-billing'

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
  const messages = useMessages(billingMessages).checkout
  const features = useMessages(marketingMessages).pricing.features
  const { tag, locale } = useI18n()
  const { status, owned, pay, redirecting } = useCheckout()
  const plan = planById('pro')
  const price = formatPrice(PRO_PRICES[interval], tag)
  const [accepted, setAccepted] = useState(false)
  const consentId = useId()

  const intervalOptions = BILLING_INTERVALS.map((value) => ({
    value,
    label: messages.intervals[value],
    description:
      value === 'year'
        ? `${formatPrice(PRO_PRICES.year, tag)}, ${messages.saveBadge}`
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
        {messages.back}
      </Link>
      <header className="mb-8">
        <h1 className="type-display text-4xl sm:text-5xl">{messages.title}</h1>
        <p className="mt-2 text-ink-soft">{messages.lead}</p>
      </header>

      {canceled && !owned && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-line bg-muted/50 px-4 py-3 text-sm"
        >
          {messages.canceled}
        </p>
      )}

      {owned ? (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="type-heading text-2xl">{messages.alreadyTitle}</h2>
          <p className="mt-2 text-ink-soft">{messages.alreadyText}</p>
          <Link
            to="/app/settings/plan"
            className={cn(buttonVariants(), 'mt-5')}
          >
            {messages.goToPlan}
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
                  {fmt(messages.item, { plan: plan.name })}
                </h2>
                <p className="mt-1 text-ink-soft">
                  {messages.itemPeriod[interval]}
                </p>
              </div>
              <p className="type-display text-3xl tabular-nums">{price}</p>
            </div>
            <Segmented
              className="mt-5"
              label={messages.billing}
              name="billing-interval"
              value={interval}
              onChange={onIntervalChange}
              options={intervalOptions}
            />
            <h3 className="mt-6 text-sm font-semibold">{messages.included}</h3>
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
              {messages.summary}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>{fmt(messages.line[interval], { plan: plan.name })}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
              <div className="flex justify-between gap-3 text-ink-soft">
                <dt>{messages.vat}</dt>
                <dd>{messages.vatValue}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-semibold">
                <dt>{messages.total}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-ink-soft">
              {fmt(messages.renews, { date: renewal, price })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{messages.promo}</p>

            <div className="mt-5 flex gap-3">
              <input
                id={consentId}
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--ink-fixed)]"
              />
              <label htmlFor={consentId} className="text-sm">
                <Consent
                  text={messages.consent}
                  terms={messages.terms}
                  privacy={messages.privacy}
                />
              </label>
            </div>
            <p className="mt-3 flex gap-2 text-sm text-ink-soft">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              {messages.refund}
            </p>

            {status && !status.enabled && (
              <div className="mt-4">
                <FormAlert>{messages.disabled}</FormAlert>
              </div>
            )}
            <Button
              size="lg"
              className="mt-5 h-12 w-full text-base"
              disabled={!accepted || !status?.enabled || redirecting}
              aria-busy={redirecting}
              onClick={() => pay(interval)}
            >
              <Lock aria-hidden className="size-4" />
              {redirecting ? messages.redirecting : messages.pay}
            </Button>
            <p className="mt-3 text-xs text-ink-soft">{messages.secure}</p>
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
