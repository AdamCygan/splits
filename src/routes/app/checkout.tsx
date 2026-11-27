import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '#/features/billing/checkout-page'
import { isBillingInterval } from '#/features/billing/plans'
import type { BillingInterval } from '#/features/billing/plans'
import { getLocale } from '#/i18n/locale'
import { billingMessages } from '#/i18n/messages/billing'
import { site } from '#/config/site'

interface CheckoutSearch {
  /** Płatność co miesiąc albo raz w roku (domyślnie: rok). */
  interval: BillingInterval
  canceled?: boolean
}

export const Route = createFileRoute('/app/checkout')({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    interval: isBillingInterval(search.interval) ? search.interval : 'year',
    ...(search.canceled === true ||
    search.canceled === '1' ||
    search.canceled === 1
      ? { canceled: true }
      : {}),
  }),
  head: () => ({
    meta: [
      {
        title: `${billingMessages[getLocale()].checkout.seoTitle} | ${site.name}`,
      },
    ],
  }),
  component: CheckoutRoute,
})

function CheckoutRoute() {
  const { interval, canceled } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CheckoutPage
      interval={interval}
      canceled={canceled === true}
      onIntervalChange={(next) =>
        void navigate({ search: { interval: next }, replace: true })
      }
    />
  )
}
