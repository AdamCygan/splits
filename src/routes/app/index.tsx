import { createFileRoute } from '@tanstack/react-router'
import { isValidDate } from '#/domain/dates'
import { TodayPage } from '#/features/time-entries/components/today'
import { getLocale } from '#/i18n/locale'
import { entriesMessages } from '#/i18n/messages/entries'

type TodaySearch = { date?: string }

export const Route = createFileRoute('/app/')({
  /** ?date=YYYY-MM-DD: inny dzień niż dziś, np. żeby dopisać zapomniane wpisy. */
  validateSearch: (search: Record<string, unknown>): TodaySearch =>
    typeof search.date === 'string' && isValidDate(search.date)
      ? { date: search.date }
      : {},
  head: () => ({
    meta: [{ title: `${entriesMessages[getLocale()].pageTitle} | Pointhours` }],
  }),
  component: TodayRoute,
})

function TodayRoute() {
  const { date } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TodayPage
      date={date}
      onDateChange={(next, today) =>
        void navigate({
          search: next === today ? {} : { date: next },
          replace: true,
        })
      }
    />
  )
}
