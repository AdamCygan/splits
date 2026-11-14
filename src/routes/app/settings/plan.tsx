import { createFileRoute } from '@tanstack/react-router'
import { PlanSettings } from '#/features/settings/components/plan'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

/** Powrót ze Stripe Checkout: ?checkout=success&session_id=cs_… */
type PlanSearch = { checkout?: 'success'; session_id?: string }

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
        title: `${settingsMessages[getLocale()].sections.plan.title} | Pointhours`,
      },
    ],
  }),
  component: PlanRoute,
})

function PlanRoute() {
  const { session_id: sessionId } = Route.useSearch()
  return <PlanSettings checkoutSession={sessionId ?? null} />
}
