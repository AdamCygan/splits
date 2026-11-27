import { ColorDot } from '#/components/ui/controls'
import type { TaskType } from '#/features/task-types/data/dto'
import { percentOf } from '#/domain/numbers'
import type { GoalProgress } from '#/domain/sprint-stats'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'

export interface TimeGoalsProps {
  progress: ReadonlyArray<GoalProgress>
  types: ReadonlyArray<TaskType>
}

/**
 * Cele czasowe bieżącego sprintu: pasek postępu na rodzaj pracy, ile zostało
 * i czy tempo się zgadza (cel rozłożony równo na dni sprintu).
 */
export function TimeGoals({ progress, types }: TimeGoalsProps) {
  const t = useMessages(panelMessages).sprints.timeGoals
  const format = useFormat()
  return (
    <section aria-labelledby="sprint-time-goals" className="mt-6">
      <h3 id="sprint-time-goals" className="mb-3 font-semibold">
        {t.title}
      </h3>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {progress.map((g) => {
          const type = types.find((x) => x.id === g.taskTypeId)
          const name = type?.name ?? '?'
          const ofGoal = fmt(t.of, {
            done: format.minutes(g.minutes),
            goal: format.minutes(g.goal),
          })
          return (
            <li key={g.taskTypeId}>
              <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                <span className="flex min-w-0 items-center gap-2">
                  <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
                  <span className="truncate font-medium">{name}</span>
                </span>
                <span className="shrink-0 tabular-nums">{ofGoal}</span>
              </p>
              <div
                role="progressbar"
                aria-label={fmt(t.label, { name })}
                aria-valuemin={0}
                aria-valuemax={g.goal}
                aria-valuenow={Math.min(g.minutes, g.goal)}
                aria-valuetext={ofGoal}
                className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="bar-grow h-full rounded-full"
                  style={{
                    width: `${percentOf(g.minutes, g.goal, true)}%`,
                    background: type?.color ?? 'var(--wt-custom)',
                  }}
                />
                {/* Gdzie powinno być przy równym tempie. */}
                {g.status !== 'done' && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-ink"
                    style={{
                      left: `${Math.min(100, (g.expected / g.goal) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {g.status === 'done'
                  ? g.minutes > g.goal
                    ? fmt(t.over, { time: format.minutes(g.minutes - g.goal) })
                    : t.done
                  : `${fmt(t.left, { time: format.minutes(g.left) })}; ${
                      g.status === 'onTrack'
                        ? t.onTrack
                        : fmt(t.behind, {
                            time: format.minutes(g.expected - g.minutes),
                          })
                    }`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">{t.paceHint}</p>
    </section>
  )
}
