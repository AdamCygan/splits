import { Panel } from '#/components/ui/panel'
import { percentOf } from '#/shared/domain/numbers'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import type { DayViewModel } from '../../controllers/use-day'

export interface TypeShareProps {
  vm: DayViewModel
}

/** Udział rodzajów pracy: poziome paski od największego, z czasem i procentem. */
export function TypeShare({ vm }: TypeShareProps) {
  const t = useMessages(dayViewMessages).types
  const format = useFormat()
  const { summary } = vm
  const top = summary.byType[0]?.minutes ?? 1
  return (
    <Panel title={t.title} lead={t.lead}>
      <ul className="space-y-3">
        {summary.byType.map((row) => (
          <li key={row.taskTypeId}>
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">
                {vm.typeOf(row.taskTypeId)?.name}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">
                  {format.minutes(row.minutes)}
                </span>{' '}
                <span className="text-ink-soft">
                  {fmt(t.share, {
                    percent: percentOf(row.minutes, summary.minutes),
                  })}
                </span>
              </span>
            </p>
            <span
              aria-hidden
              className="mt-1 block h-2 rounded-r-[4px]"
              style={{
                width: `${(row.minutes / top) * 100}%`,
                background: vm.colorOf(row.taskTypeId),
              }}
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}
