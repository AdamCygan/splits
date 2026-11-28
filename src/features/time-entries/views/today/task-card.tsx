import {
  ExternalLink,
  Pause,
  Play,
  ScrollText,
  Square,
  Trash2,
} from 'lucide-react'
import { ActionMenu } from '#/components/ui/action-menu'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { TaskLink } from '#/features/tasks/views/task-link'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { TaskProgress } from '../task-progress'
import { useElapsed } from '../../controllers/use-timer'
import { SessionRow } from './session-row'
import type {
  DayTask,
  EntryListViewModel,
} from '../../controllers/use-entry-list'
import { safeUrl } from '#/features/time-entries/domain/entries'

interface TaskTotalProps {
  done: number
  running: TimeEntry | undefined
}

/** Suma czasu zadania dziś: zakończone odcinki plus działający (odświeżany co sekundę). */
function TaskTotal({ done, running }: TaskTotalProps) {
  const format = useFormat()
  const seconds = useElapsed(running)
  return <span>{format.minutes(done + Math.floor(seconds / 60))}</span>
}

export interface TaskCardProps {
  task: DayTask
  viewModel: EntryListViewModel
}

/** Karta zadania na liście dnia: nagłówek, opis, postęp SP, sesje i akcje timera. */
export function TaskCard({ task, viewModel }: TaskCardProps) {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const { latest, running, paused, type, project } = task
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ background: type?.color ?? 'var(--ink-faint)' }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 flex-1 font-semibold break-words">
              <TaskLink task={latest}>{latest.title}</TaskLink>
            </h3>
            <p className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
              {running && (
                <Badge tone="success">{messages.timer.running}</Badge>
              )}
              {paused && <Badge tone="warning">{messages.timer.paused}</Badge>}
              <TaskTotal done={task.doneMinutes} running={running} />
            </p>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <span>{type?.name}</span>
            {task.storyPoints !== null && (
              <>
                <span aria-hidden>·</span>
                <span>{format.sp(task.storyPoints)}</span>
              </>
            )}
            {task.estimateMinutes !== null && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {fmt(messages.list.estimate, {
                    time: format.minutes(task.estimateMinutes),
                  })}
                </span>
              </>
            )}
            {project && (
              <Badge tone="muted">{project.key ?? project.name}</Badge>
            )}
            {latest.link && (
              <a
                href={safeUrl(latest.link)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
              >
                <ExternalLink aria-hidden className="size-3.5" />
                {task.taskKey ?? 'Link'}
                <span className="sr-only">
                  : {fmt(messages.list.openLink, { name: latest.title })}
                </span>
              </a>
            )}
          </p>
          {!task.isMeeting && task.storyPoints !== null && (
            <TaskProgress entry={running ?? latest} />
          )}

          {/* Odcinki czasu tego zadania, od najwcześniejszego: np. 6:40–7:20, potem 9:00–10:00 */}
          <ol
            aria-label={fmt(messages.list.sessions, { name: latest.title })}
            className="mt-3 space-y-2 border-l-2 border-line pl-3"
          >
            {task.sessions.map((entry) => (
              <SessionRow
                key={entry.id}
                entry={entry}
                task={task}
                viewModel={viewModel}
              />
            ))}
          </ol>

          <div className="mt-3 -ml-2.5 flex flex-wrap gap-1">
            {running ? (
              <>
                <Button
                  size="sm"
                  className="ml-2.5"
                  disabled={viewModel.timerBusy}
                  onClick={() => viewModel.pause(running)}
                >
                  <Pause aria-hidden className="size-3.5" fill="currentColor" />
                  {messages.timer.pause}
                  <span className="sr-only">: {latest.title}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={viewModel.timerBusy}
                  onClick={() => viewModel.stop(running)}
                >
                  <Square
                    aria-hidden
                    className="size-3.5"
                    fill="currentColor"
                  />
                  {messages.timer.stop}
                  <span className="sr-only">: {latest.title}</span>
                </Button>
              </>
            ) : (
              <Button
                variant={paused ? 'default' : 'ghost'}
                size="sm"
                className={paused ? 'ml-2.5' : undefined}
                disabled={viewModel.timerBusy}
                onClick={() => viewModel.resume(latest)}
              >
                <Play aria-hidden className="size-4" />
                {paused ? messages.timer.resume : messages.timer.startAgain}
                <span className="sr-only">: {latest.title}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => viewModel.open({ kind: 'summary', entry: latest })}
            >
              <ScrollText aria-hidden className="size-4" />
              {messages.taskSummary.open}
              <span className="sr-only">: {latest.title}</span>
            </Button>
            <ActionMenu
              className="ml-auto"
              title={messages.list.taskMore}
              label={fmt(messages.list.taskMoreLabel, { name: latest.title })}
              actions={[
                {
                  label: messages.deleteTask.dayItem,
                  icon: Trash2,
                  destructive: true,
                  onSelect: () =>
                    viewModel.open({ kind: 'deleteTask', group: task }),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </li>
  )
}
