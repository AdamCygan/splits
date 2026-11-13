import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '#/features/reports/reports-page'
import { getLocale } from '#/i18n/locale'
import { reportsMessages } from '#/i18n/messages/reports'

type ReportsSearch = { sprint?: string }

export const Route = createFileRoute('/app/analytics')({
  /** ?sprint=<id>: raport otwarty od razu na wybranym sprincie (linki ze strony Sprinty). */
  validateSearch: (search: Record<string, unknown>): ReportsSearch =>
    typeof search.sprint === 'string' && /^[0-9a-f-]{36}$/.test(search.sprint)
      ? { sprint: search.sprint }
      : {},
  head: () => ({
    meta: [{ title: `${reportsMessages[getLocale()].pageTitle} | Splits` }],
  }),
  component: ReportsRoute,
})

function ReportsRoute() {
  const { sprint } = Route.useSearch()
  return <ReportsPage key={sprint ?? 'default'} initialSprintId={sprint} />
}
