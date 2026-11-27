import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { TaskRef } from '#/features/time-entries/data/dto'
import { cn } from '#/lib/utils'

export interface TaskLinkProps {
  task: TaskRef
  children: ReactNode
  className?: string
  label?: string
}

/** Link do strony zadania (/app/task): typ pracy, tytuł i link jak w grupowaniu raportu. */
export function TaskLink({ task, children, className, label }: TaskLinkProps) {
  return (
    <Link
      to="/app/task"
      search={{
        type: task.taskTypeId,
        title: task.title,
        ...(task.link ? { link: task.link } : {}),
      }}
      aria-label={label}
      className={cn('rounded-sm underline-offset-4 hover:underline', className)}
    >
      {children}
    </Link>
  )
}
