import { createFileRoute } from '@tanstack/react-router'
import { PlanSettings } from '#/features/billing/views/plan-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

/** Powrót ze Stripe Checkout: ?checkout=success&session_id=cs_… */
interface PlanSearch {
  checkout?: 'success'
  session_id?: string
}

export const Route = createFileRoute('/app/settings/plan')({
  validateSearch: (search: Record<string, unknown>): PlanSearch =>
    search.checkout === 'success' &&
    typeof search.session_id === 'string' &&
    /^cs_\w+$/.test(search.session_id)
      ? { checkout: 'success', session_id: search.session_id }
      : {},
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.plan.title} | ${site.name}`,
      },
    ],
  }),
  component: PlanRoute,
})

function PlanRoute() {
  const { session_id: sessionId } = Route.useSearch()
  return <PlanSettings checkoutSession={sessionId ?? null} />
}
