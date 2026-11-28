import type { TaskType } from '#/features/task-types/data/dto'
import type { TypeRow } from '#/features/reports/domain/report'
import { cn } from '#/lib/utils'

export interface TypeBarProps {
  rows: ReadonlyArray<TypeRow>
  types: ReadonlyArray<TaskType>
  className?: string
}

/** Pasek „na co poszedł czas”: segmenty w kolorach rodzajów pracy (ozdobny, treść obok). */
export function TypeBar({ rows, types, className }: TypeBarProps) {
  const total = rows.reduce((sum, typeRow) => sum + typeRow.minutes, 0)
  if (total === 0)
    return (
      <div aria-hidden className={cn('rounded-full bg-muted', className)} />
    )
  return (
    <div
      aria-hidden
      className={cn('flex gap-0.5 overflow-hidden rounded-full', className)}
    >
      {rows.map((typeRow) => (
        <span
          key={typeRow.taskTypeId}
          className="bar-grow h-full min-w-1"
          style={{
            width: `${(typeRow.minutes / total) * 100}%`,
            background:
              types.find((taskType) => taskType.id === typeRow.taskTypeId)
                ?.color ?? 'var(--wt-custom)',
          }}
        />
      ))}
    </div>
  )
}
