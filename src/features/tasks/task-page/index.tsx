import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { SummaryDialog } from '#/features/time-entries/components/summary-dialog'
import {
  Sessions,
  TaskDetails,
} from '#/features/time-entries/components/task-dialog'
import { useMessages } from '#/i18n/context'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { Interrupted } from './interrupted'
import { TaskHeader } from './task-header'
import { TaskNotes } from './task-notes'
import { TaskStats } from './task-stats'
import { TaskTimeline } from './task-timeline'
import { useTaskViewModel } from './use-task'
import type { TaskPageProps } from './use-task'

/**
 * Strona jednego zadania (widok w MVVM): ile zajęło, w ilu sesjach i dniach, jak często
 * coś odrywało od niego pracę i co to było, notatki, a pod spodem edycja zadania i sesji.
 */
export function TaskPage(props: TaskPageProps) {
  const t = useMessages(taskViewMessages)
  const vm = useTaskViewModel(props)
  const { task } = props
  const back = (
    <Link
      to="/app/tasks"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {t.back}
    </Link>
  )

  if (vm.pending)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div
          aria-hidden
          className="mt-4 h-64 animate-pulse rounded-2xl bg-muted"
        />
      </div>
    )
  if (!vm.insights || !vm.latest)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <h1 className="type-display mt-2 text-4xl">{task.title}</h1>
        <p className="mt-4 text-ink-soft">{t.notFound}</p>
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl">
      {back}
      <TaskHeader vm={vm} />
      <TaskStats vm={vm} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <TaskTimeline vm={vm} />
          <TaskNotes vm={vm} />
        </div>
        <div className="space-y-6">
          <Interrupted vm={vm} />
          <div className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
            <TaskDetails
              key={`${task.taskTypeId}|${task.link ?? ''}|${task.title}`}
              entries={vm.sessions}
              type={vm.type}
              onSaved={vm.saved}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <Sessions entries={vm.sessions} />
      </div>

      {vm.summarizing && (
        <SummaryDialog
          entry={vm.latest}
          type={vm.type}
          onClose={vm.closeSummary}
        />
      )}
    </div>
  )
}
