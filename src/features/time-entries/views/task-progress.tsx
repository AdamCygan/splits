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
  const t = useMessages(entriesMessages).progress
  const format = useFormat()
  const p = useTaskProgress(entry)
  if (!p) return null
  const share = Math.min(100, (p.worked / p.budget) * 100)
  const full = [
    fmt(t.text, {
      earned: format.number(p.earned),
      sp: format.sp(p.sp),
      worked: format.minutes(p.worked),
      budget: format.minutes(p.budget),
    }),
    p.over > 0
      ? fmt(t.over, { time: format.minutes(p.over) })
      : fmt(t.left, { time: format.minutes(p.budget - p.worked) }),
    p.fromEstimate ? t.fromEstimate : t.fromScale,
  ].join(' · ')
  return (
    <div className={cn('mt-2 flex items-center gap-3', className)} title={full}>
      <div
        role="progressbar"
        aria-label={t.label}
        aria-valuemin={0}
        aria-valuemax={p.sp}
        aria-valuenow={p.earned}
        aria-valuetext={full}
        className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            p.over > 0 ? 'bg-wt-review' : 'bg-ink',
          )}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="shrink-0 text-xs text-ink-soft tabular-nums">
        {fmt(t.ofBudget, {
          worked: format.minutes(p.worked),
          budget: format.minutes(p.budget),
        })}
        {p.over > 0 ? (
          <span className="ml-1.5 rounded-full bg-wt-review/15 px-1.5 py-0.5 font-semibold text-ink">
            {fmt(t.overShort, { time: format.minutes(p.over) })}
          </span>
        ) : (
          <span className="ml-1.5">
            {fmt(t.left, { time: format.minutes(p.budget - p.worked) })}
          </span>
        )}
      </p>
    </div>
  )
}
