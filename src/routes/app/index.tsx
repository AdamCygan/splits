import { createFileRoute } from '@tanstack/react-router'
import { isValidDate } from '#/domain/dates'
import { TodayPage } from '#/features/time-entries/components/today'
import type { TodayRequest } from '#/features/time-entries/components/today'
import { getLocale } from '#/i18n/locale'
import { entriesMessages } from '#/i18n/messages/entries'
import { site } from '#/config/site'

type TodaySearch = TodayRequest & { date?: string }

const MODES = ['timer', 'range', 'duration'] as const

export const Route = createFileRoute('/app/')({
  /**
   * ?date=YYYY-MM-DD: inny dzień niż dziś, np. żeby dopisać zapomniane wpisy.
   * ?log=tytuł&mode=timer oraz ?template=id: polecenia z palety (Ctrl+K), wykonywane raz.
   */
  validateSearch: (search: Record<string, unknown>): TodaySearch => ({
    ...(typeof search.date === 'string' && isValidDate(search.date)
      ? { date: search.date }
      : {}),
    ...(typeof search.log === 'string'
      ? { log: search.log.slice(0, 200) }
      : {}),
    ...(typeof search.mode === 'string' &&
    (MODES as ReadonlyArray<string>).includes(search.mode)
      ? { mode: search.mode as TodayRequest['mode'] }
      : {}),
    ...(typeof search.template === 'string'
      ? { template: search.template }
      : {}),
  }),
  head: () => ({
    meta: [{ title: `${entriesMessages[getLocale()].pageTitle} | ${site.name}` }],
  }),
  component: TodayRoute,
})

function TodayRoute() {
  const { date, log, mode, template } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TodayPage
      date={date}
      request={{ log, mode, template }}
      onRequestDone={() =>
        void navigate({ search: date ? { date } : {}, replace: true })
      }
      onDateChange={(next, today) =>
        void navigate({
          search: next === today ? {} : { date: next },
          replace: true,
        })
      }
    />
  )
}
