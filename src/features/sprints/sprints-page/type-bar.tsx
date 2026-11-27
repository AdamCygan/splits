import type { TaskType } from '#/features/task-types/data/dto'
import type { TypeRow } from '#/domain/report'
import { cn } from '#/lib/utils'

export interface TypeBarProps {
  rows: ReadonlyArray<TypeRow>
  types: ReadonlyArray<TaskType>
  className?: string
}

/** Pasek „na co poszedł czas”: segmenty w kolorach rodzajów pracy (ozdobny, treść obok). */
export function TypeBar({ rows, types, className }: TypeBarProps) {
  const total = rows.reduce((sum, r) => sum + r.minutes, 0)
  if (total === 0)
    return (
      <div aria-hidden className={cn('rounded-full bg-muted', className)} />
    )
  return (
    <div
      aria-hidden
      className={cn('flex gap-0.5 overflow-hidden rounded-full', className)}
    >
      {rows.map((r) => (
        <span
          key={r.taskTypeId}
          className="bar-grow h-full min-w-1"
          style={{
            width: `${(r.minutes / total) * 100}%`,
            background:
              types.find((x) => x.id === r.taskTypeId)?.color ??
              'var(--wt-custom)',
          }}
        />
      ))}
    </div>
  )
}
