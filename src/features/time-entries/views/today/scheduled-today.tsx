import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { nowTimeIn } from '#/shared/domain/dates'
import { isLogged, scheduledOn } from '#/features/templates/domain/schedule'
import { daysOffQuery } from '#/features/days-off/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { useFormat } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesQuery } from '../../data/queries'
import type { QuickTemplatesViewModel } from '../../controllers/use-quick-templates'

export interface ScheduledTodayProps {
  viewModel: QuickTemplatesViewModel
}

/**
 * Spotkania z harmonogramu na ten dzień (np. daily o 9:30, a w poniedziałki o 10:00):
 * już wpisane mają znacznik, te, które się zaczęły, wpisuje się jednym kliknięciem
 * z godzinami od–do. W dzień wolny lista się nie pokazuje.
 */
export function ScheduledToday({ viewModel }: ScheduledTodayProps) {
  const messages = viewModel.t.scheduled
  const format = useFormat()
  const timeZone = useQuery(settingsQuery).data?.timezone
  const entries = useQuery(entriesQuery(viewModel.workDate)).data ?? []
  const dayOff = useQuery(daysOffQuery(viewModel.workDate, viewModel.workDate))
    .data?.[0]
  const meetings = scheduledOn(viewModel.templates, viewModel.workDate)
  const hasNothingScheduled = meetings.length === 0 || dayOff
  if (hasNothingScheduled) return null
  const now = viewModel.isToday ? nowTimeIn(timeZone) : '24:00'
  const rows = meetings.map((scheduledMeeting) => ({
    ...scheduledMeeting,
    logged: isLogged(entries, scheduledMeeting.template),
    started: scheduledMeeting.start <= now,
  }))
  const open = rows.filter((row) => !row.logged && row.started)
  return (
    <section
      aria-labelledby="scheduled-today"
      className="mb-6 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="scheduled-today" className="font-semibold">
          {viewModel.isToday ? messages.titleToday : messages.title}
        </h2>
        {open.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={viewModel.busy}
            onClick={() => viewModel.logAll(open)}
          >
            {fmt(messages.logAll, { n: open.length })}
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((row) => {
          const when = format.timeRange(row.start, row.end)
          return (
            <li
              key={row.template.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: viewModel.typeOf(row.template.taskTypeId)?.color,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{row.template.label}</span>{' '}
                <span className="text-sm text-ink-soft tabular-nums">
                  {when}
                </span>
              </span>
              {row.logged ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
                  <Check aria-hidden className="size-4" />
                  {messages.logged}
                </span>
              ) : row.started ? (
                <Button
                  size="sm"
                  disabled={viewModel.busy}
                  onClick={() => viewModel.use(row.template, row)}
                  aria-label={fmt(messages.logNamed, {
                    name: row.template.label,
                    time: when,
                  })}
                >
                  <Plus aria-hidden className="size-4" />
                  {messages.log}
                </Button>
              ) : (
                <span className="text-sm text-ink-soft">
                  {messages.upcoming}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
