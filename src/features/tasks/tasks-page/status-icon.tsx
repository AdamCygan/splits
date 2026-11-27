import { Circle, CircleCheck } from 'lucide-react'
import type { TaskStatus } from '#/domain/task-list'

export interface StatusIconProps {
  state: TaskStatus
  label: string
}

/** Stan zadania jako ikona z tekstem dla czytników ekranu. */
export function StatusIcon({ state, label }: StatusIconProps) {
  return (
    <span className="mt-0.5 flex size-5 items-center justify-center lg:mt-0">
      {state === 'done' ? (
        <CircleCheck aria-hidden className="size-5 text-ok" />
      ) : state === 'running' ? (
        <span aria-hidden className="relative flex size-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--wt-task)] opacity-60 motion-reduce:hidden" />
          <span className="relative size-3 rounded-full bg-[var(--wt-task)]" />
        </span>
      ) : (
        <Circle aria-hidden className="size-5 text-ink-faint" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
