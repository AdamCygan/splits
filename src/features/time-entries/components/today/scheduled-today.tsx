import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { nowTimeIn } from '#/domain/dates'
import { isLogged, scheduledOn } from '#/domain/schedule'
import { daysOffQuery, settingsQuery } from '#/features/settings/queries'
import { useFormat } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesQuery } from '../../queries'
import type { QuickTemplatesViewModel } from './use-quick-templates'

export interface ScheduledTodayProps {
  vm: QuickTemplatesViewModel
}

/**
 * Spotkania z harmonogramu na ten dzień (np. daily o 9:30, a w poniedziałki o 10:00):
 * już wpisane mają znacznik, te, które się zaczęły, wpisuje się jednym kliknięciem
 * z godzinami od–do. W dzień wolny lista się nie pokazuje.
 */
export function ScheduledToday({ vm }: ScheduledTodayProps) {
  const t = vm.t.scheduled
  const format = useFormat()
  const timeZone = useQuery(settingsQuery).data?.timezone
  const entries = useQuery(entriesQuery(vm.workDate)).data ?? []
  const dayOff = useQuery(daysOffQuery(vm.workDate, vm.workDate)).data?.[0]
  const meetings = scheduledOn(vm.templates, vm.workDate)
  if (meetings.length === 0 || dayOff) return null
  const now = vm.isToday ? nowTimeIn(timeZone) : '24:00'
  const rows = meetings.map((m) => ({
    ...m,
    logged: isLogged(entries, m.template),
    started: m.start <= now,
  }))
  const open = rows.filter((r) => !r.logged && r.started)
  return (
    <section
      aria-labelledby="scheduled-today"
      className="mb-6 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="scheduled-today" className="font-semibold">
          {vm.isToday ? t.titleToday : t.title}
        </h2>
        {open.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={vm.busy}
            onClick={() => vm.logAll(open)}
          >
            {fmt(t.logAll, { n: open.length })}
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => {
          const when = format.timeRange(r.start, r.end)
          return (
            <li
              key={r.template.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: vm.typeOf(r.template.taskTypeId)?.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{r.template.label}</span>{' '}
                <span className="text-sm text-ink-soft tabular-nums">
                  {when}
                </span>
              </span>
              {r.logged ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
                  <Check aria-hidden className="size-4" />
                  {t.logged}
                </span>
              ) : r.started ? (
                <Button
                  size="sm"
                  disabled={vm.busy}
                  onClick={() => vm.use(r.template, r)}
                  aria-label={fmt(t.logNamed, {
                    name: r.template.label,
                    time: when,
                  })}
                >
                  <Plus aria-hidden className="size-4" />
                  {t.log}
                </Button>
              ) : (
                <span className="text-sm text-ink-soft">{t.upcoming}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
