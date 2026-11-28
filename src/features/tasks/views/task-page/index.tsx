import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { SummaryDialog } from '#/features/time-entries/views/summary-dialog'
import {
  Sessions,
  TaskDetails,
} from '#/features/time-entries/views/task-dialog'
import { useMessages } from '#/i18n/context'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { Interrupted } from './interrupted'
import { TaskHeader } from './task-header'
import { TaskNotes } from './task-notes'
import { TaskStats } from './task-stats'
import { TaskTimeline } from './task-timeline'
import { useTaskViewModel } from '../../controllers/use-task'
import type { TaskPageProps } from '../../controllers/use-task'

/**
 * Strona jednego zadania (widok w MVVM): ile zajęło, w ilu sesjach i dniach, jak często
 * coś odrywało od niego pracę i co to było, notatki, a pod spodem edycja zadania i sesji.
 */
export function TaskPage(props: TaskPageProps) {
  const messages = useMessages(taskViewMessages)
  const viewModel = useTaskViewModel(props)
  const { task } = props
  const back = (
    <Link
      to="/app/tasks"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {messages.back}
    </Link>
  )

  if (viewModel.pending)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div
          aria-hidden
          className="mt-4 h-64 animate-pulse rounded-2xl bg-muted"
        />
      </div>
    )
  const { latest } = viewModel
  const isLoading = !viewModel.insights || !latest
  if (isLoading)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <h1 className="type-display mt-2 text-4xl">{task.title}</h1>
        <p className="mt-4 text-ink-soft">{messages.notFound}</p>
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl">
      {back}
      <TaskHeader viewModel={viewModel} />
      <TaskStats viewModel={viewModel} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <TaskTimeline viewModel={viewModel} />
          <TaskNotes viewModel={viewModel} />
        </div>
        <div className="space-y-6">
          <Interrupted viewModel={viewModel} />
          <div className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
            <TaskDetails
              key={`${task.taskTypeId}|${task.link ?? ''}|${task.title}`}
              entries={viewModel.sessions}
              type={viewModel.type}
              onSaved={viewModel.saved}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <Sessions entries={viewModel.sessions} />
      </div>

      {viewModel.summarizing && (
        <SummaryDialog
          entry={latest}
          type={viewModel.type}
          onClose={viewModel.closeSummary}
        />
      )}
    </div>
  )
}
