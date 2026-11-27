import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isValidDate, todayIn } from '#/domain/dates'
import { DayPage } from '#/features/day/day-page'
import { settingsQuery } from '#/features/settings/queries'
import { getLocale } from '#/i18n/locale'
import { dayViewMessages } from '#/i18n/messages/day-view'
import { site } from '#/config/site'

interface DaySearch {
  date?: string
}

export const Route = createFileRoute('/app/day')({
  /** ?date=YYYY-MM-DD: dzień z wykresu w Raportach; bez daty = dziś. */
  validateSearch: (search: Record<string, unknown>): DaySearch =>
    typeof search.date === 'string' && isValidDate(search.date)
      ? { date: search.date }
      : {},
  head: () => ({
    meta: [{ title: `${dayViewMessages[getLocale()].seoTitle} | ${site.name}` }],
  }),
  component: DayRoute,
})

function DayRoute() {
  const { date } = Route.useSearch()
  const settings = useQuery(settingsQuery).data
  const day = date ?? todayIn(settings?.timezone)
  return <DayPage key={day} date={day} />
}
