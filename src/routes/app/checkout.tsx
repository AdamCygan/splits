import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '#/features/billing/checkout-page'
import { getLocale } from '#/i18n/locale'
import { billingMessages } from '#/i18n/messages/billing'
import { site } from '#/config/site'

interface CheckoutSearch {
  plan: 'pro'
  canceled?: boolean
}

export const Route = createFileRoute('/app/checkout')({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    plan: 'pro',
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
  const { plan, canceled } = Route.useSearch()
  return <CheckoutPage planId={plan} canceled={canceled === true} />
}
