import { ColorDot } from '#/components/ui/controls'
import type { TaskType } from '#/features/task-types/data/dto'
import { percentOf } from '#/shared/domain/numbers'
import type { GoalProgress } from '#/features/sprints/domain/sprint-stats'
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
  const messages = useMessages(panelMessages).sprints.timeGoals
  const format = useFormat()
  return (
    <section aria-labelledby="sprint-time-goals" className="mt-6">
      <h3 id="sprint-time-goals" className="mb-3 font-semibold">
        {messages.title}
      </h3>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {progress.map((goalProgress) => {
          const type = types.find(
            (taskType) => taskType.id === goalProgress.taskTypeId,
          )
          const name = type?.name ?? '?'
          const ofGoal = fmt(messages.of, {
            done: format.minutes(goalProgress.minutes),
            goal: format.minutes(goalProgress.goal),
          })
          return (
            <li key={goalProgress.taskTypeId}>
              <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                <span className="flex min-w-0 items-center gap-2">
                  <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
                  <span className="truncate font-medium">{name}</span>
                </span>
                <span className="shrink-0 tabular-nums">{ofGoal}</span>
              </p>
              <div
                role="progressbar"
                aria-label={fmt(messages.label, { name })}
                aria-valuemin={0}
                aria-valuemax={goalProgress.goal}
                aria-valuenow={Math.min(
                  goalProgress.minutes,
                  goalProgress.goal,
                )}
                aria-valuetext={ofGoal}
                className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="bar-grow h-full rounded-full"
                  style={{
                    width: `${percentOf(goalProgress.minutes, goalProgress.goal, true)}%`,
                    background: type?.color ?? 'var(--wt-custom)',
                  }}
                />
                {/* Gdzie powinno być przy równym tempie. */}
                {goalProgress.status !== 'done' && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-ink"
                    style={{
                      left: `${Math.min(100, (goalProgress.expected / goalProgress.goal) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {goalProgress.status === 'done'
                  ? goalProgress.minutes > goalProgress.goal
                    ? fmt(messages.over, {
                        time: format.minutes(
                          goalProgress.minutes - goalProgress.goal,
                        ),
                      })
                    : messages.done
                  : `${fmt(messages.left, { time: format.minutes(goalProgress.left) })}; ${
                      goalProgress.status === 'onTrack'
                        ? messages.onTrack
                        : fmt(messages.behind, {
                            time: format.minutes(
                              goalProgress.expected - goalProgress.minutes,
                            ),
                          })
                    }`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">{messages.paceHint}</p>
    </section>
  )
}
