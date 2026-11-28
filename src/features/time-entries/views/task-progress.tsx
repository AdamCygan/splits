import { useTaskProgress } from '../controllers/use-task-progress'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'

export interface TaskProgressProps {
  entry: TimeEntry
  className?: string
}

/**
 * Pasek „ile SP już zrobione” pod zadaniem na Dziś. Na widoku krótko: czas z budżetu
 * i plakietka przekroczenia; pełny opis (ile SP, skąd budżet) w aria i podpowiedzi.
 * Przekroczenie jest bursztynowe, nie czerwone: to informacja, nie błąd.
 */
export function TaskProgress({ entry, className }: TaskProgressProps) {
  const messages = useMessages(entriesMessages).progress
  const format = useFormat()
  const taskProgress = useTaskProgress(entry)
  if (!taskProgress) return null
  const share = Math.min(100, (taskProgress.worked / taskProgress.budget) * 100)
  const full = [
    fmt(messages.text, {
      earned: format.number(taskProgress.earned),
      sp: format.sp(taskProgress.sp),
      worked: format.minutes(taskProgress.worked),
      budget: format.minutes(taskProgress.budget),
    }),
    taskProgress.over > 0
      ? fmt(messages.over, { time: format.minutes(taskProgress.over) })
      : fmt(messages.left, {
          time: format.minutes(taskProgress.budget - taskProgress.worked),
        }),
    taskProgress.fromEstimate ? messages.fromEstimate : messages.fromScale,
  ].join(' · ')
  return (
    <div className={cn('mt-2 flex items-center gap-3', className)} title={full}>
      <div
        role="progressbar"
        aria-label={messages.label}
        aria-valuemin={0}
        aria-valuemax={taskProgress.sp}
        aria-valuenow={taskProgress.earned}
        aria-valuetext={full}
        className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            taskProgress.over > 0 ? 'bg-wt-review' : 'bg-ink',
          )}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="shrink-0 text-xs text-ink-soft tabular-nums">
        {fmt(messages.ofBudget, {
          worked: format.minutes(taskProgress.worked),
          budget: format.minutes(taskProgress.budget),
        })}
        {taskProgress.over > 0 ? (
          <span className="ml-1.5 rounded-full bg-wt-review/15 px-1.5 py-0.5 font-semibold text-ink">
            {fmt(messages.overShort, {
              time: format.minutes(taskProgress.over),
            })}
          </span>
        ) : (
          <span className="ml-1.5">
            {fmt(messages.left, {
              time: format.minutes(taskProgress.budget - taskProgress.worked),
            })}
          </span>
        )}
      </p>
    </div>
  )
}
