import { Panel } from '#/components/ui/panel'
import { taskDayTimeline } from '#/domain/task-insights'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { cn } from '#/lib/utils'
import type { TaskViewModel } from './use-task'

/**
 * Oś dnia: sesje zadania w kolorze rodzaju, inna praca na szaro, luki widać jako puste
 * miejsca. Zakres osi: od najwcześniejszego do najpóźniejszego wpisu z godzinami tego dnia.
 */
export function TaskTimeline({ vm }: { vm: TaskViewModel }) {
  const t = useMessages(taskViewMessages).timeline
  const format = useFormat()
  if (!vm.insights) return null
  return (
    <Panel title={t.title} lead={t.lead}>
      <ol className="space-y-4">
        {vm.insights.days.map((day) => {
          const line = taskDayTimeline(day.date, vm.sessions, vm.sameDays)
          return (
            <li key={day.date}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{format.day(day.date)}</span>
                <span className="text-ink-soft tabular-nums">
                  {format.plural(t.sessions, day.sessions)},{' '}
                  <span className="font-semibold text-ink">
                    {format.minutes(day.minutes)}
                  </span>
                </span>
              </p>
              {line.segments.length > 0 && (
                <>
                  <div className="relative mt-1.5 h-7 overflow-hidden rounded-md bg-muted">
                    {line.segments.map((x) => {
                      const e = x.entry
                      const label = x.own
                        ? fmt(t.session, {
                            name: e.title,
                            from: format.time(x.start),
                            to: format.time(x.end),
                            time: format.minutes(e.durationMinutes),
                          })
                        : fmt(t.other, {
                            name: `${vm.typeOf(e.taskTypeId)?.name ?? ''} ${e.title}`.trim(),
                            time: format.minutes(e.durationMinutes),
                          })
                      const { left, width } = line.place(x)
                      return (
                        <span
                          key={e.id}
                          title={label}
                          className={cn(
                            'absolute inset-y-0 border-x border-surface',
                            x.own ? 'z-10' : 'bg-ink-soft/35',
                          )}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: x.own ? vm.color : undefined,
                          }}
                        >
                          <span className="sr-only">{label}</span>
                        </span>
                      )
                    })}
                  </div>
                  <p
                    aria-hidden
                    className="mt-1 flex justify-between text-xs text-ink-soft tabular-nums"
                  >
                    <span>{format.time(line.from)}</span>
                    <span>{format.time(line.to)}</span>
                  </p>
                </>
              )}
              {line.untimedMinutes > 0 && (
                <p className="mt-1 text-xs text-ink-soft">
                  {fmt(t.untimed, {
                    time: format.minutes(line.untimedMinutes),
                  })}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}
