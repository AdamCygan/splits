import {
  ExternalLink,
  MoreHorizontal,
  Play,
  ScrollText,
  Trash2,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ColorDot } from '#/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { linkLabel } from '#/features/tasks/domain/links'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'
import { TaskLink } from '../task-link'
import { EstimateCell } from './estimate-cell'
import { StatusIcon } from './status-icon'
import type { TaskListItem, TasksViewModel } from '../../controllers/use-tasks'
import { safeUrl } from '#/features/time-entries/domain/entries'

export interface TaskRowViewProps {
  item: TaskListItem
  viewModel: TasksViewModel
}

/**
 * Wiersz zadania: stan, tytuł z linkiem, opis (rodzaj, ostatnia praca, sesje), SP, czas
 * z paskiem względem najdłuższego zadania, wycena i akcje („Kontynuuj”, menu „⋯”).
 */
export function TaskRowView({
  item: { row, estimate },
  viewModel,
}: TaskRowViewProps) {
  const messages = useMessages(panelMessages).tasks
  const format = useFormat()
  const type = viewModel.typeOf(row.taskTypeId)
  const entry = viewModel.latestOf(row)
  const state = viewModel.statusOf(row)
  return (
    <li className="row-hover grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-5 py-4 sm:px-6 lg:grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_8.75rem] lg:items-center lg:gap-x-5">
      <StatusIcon state={state} label={messages.state[state]} />
      <div className="min-w-0">
        <p className="min-w-0 break-words">
          <TaskLink
            task={row}
            className={cn(
              'mr-2 font-semibold',
              state === 'done' && 'text-ink-soft',
            )}
          >
            {row.title}
          </TaskLink>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {row.link && (
            <>
              <a
                href={safeUrl(row.link)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                <ExternalLink aria-hidden className="size-3.5" />
                {linkLabel(row.link, row.taskKey)}
                <span className="sr-only">
                  {': '}
                  {fmt(messages.open, { name: row.title })}
                </span>
              </a>
              <span aria-hidden> · </span>
            </>
          )}
          {viewModel.grouping !== 'kind' && (
            <span className="mr-1.5 inline-flex items-center gap-1.5 align-middle">
              <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
              {type?.name}
              <span aria-hidden>·</span>
            </span>
          )}
          {viewModel.grouping !== 'day' && (
            <>
              {fmt(messages.lastShort, { date: format.day(row.last) })}
              <span aria-hidden> · </span>
            </>
          )}
          {fmt(messages.meta, {
            sessions: format.plural(messages.sessions, row.sessions),
            days: format.plural(messages.days, row.days),
          })}
        </p>
      </div>

      {/* Liczby: na wąskim ekranie w jednej linii pod tytułem, na szerokim w kolumnach. */}
      <div className="col-start-2 flex flex-wrap items-center gap-x-5 gap-y-2 lg:contents">
        <p className="text-sm tabular-nums lg:text-right">
          <span className="sr-only">{messages.columns.sp}: </span>
          {row.storyPoints === null ? (
            <span className="text-ink-faint">–</span>
          ) : (
            <span className="font-medium">{format.sp(row.storyPoints)}</span>
          )}
        </p>
        <div className="min-w-32 lg:min-w-0">
          <p className="flex items-baseline justify-between gap-2 tabular-nums">
            <span className="sr-only">{messages.columns.time}: </span>
            <span className="font-semibold">{format.minutes(row.minutes)}</span>
            {row.overtimeMinutes > 0 && (
              <span
                className="text-xs text-ink-soft"
                title={row.overtimeNotes.join('\n')}
              >
                {fmt(messages.summary.overtime, {
                  time: format.minutes(row.overtimeMinutes),
                })}
              </span>
            )}
          </p>
          <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(3, (row.minutes / viewModel.longest) * 100)}%`,
                background: type?.color ?? 'var(--wt-custom)',
              }}
            />
          </span>
        </div>
        <EstimateCell row={row} estimate={estimate} />
        {entry && (
          <div className="flex items-center gap-1 max-lg:ml-auto lg:justify-end">
            {state !== 'done' && (
              <Button
                size="sm"
                variant="outline"
                disabled={viewModel.resumeBusy || row.running}
                aria-label={fmt(messages.continueLabel, { name: row.title })}
                onClick={() => viewModel.resume(entry)}
              >
                <Play aria-hidden fill="currentColor" className="size-3.5" />
                {messages.continue}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  aria-label={fmt(messages.moreActions, { name: row.title })}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {state === 'done' && (
                  <DropdownMenuItem
                    disabled={viewModel.resumeBusy}
                    onSelect={() => viewModel.resume(entry)}
                  >
                    <Play aria-hidden />
                    {messages.continue}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => viewModel.summarize(entry)}>
                  <ScrollText aria-hidden />
                  {messages.summaryButton}
                </DropdownMenuItem>
                {row.link && (
                  <DropdownMenuItem asChild>
                    <a
                      href={safeUrl(row.link)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink aria-hidden />
                      {messages.openLink}
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive [&_svg]:text-destructive"
                  onSelect={() => viewModel.askDelete(row)}
                >
                  <Trash2 aria-hidden />
                  {messages.deleteTask}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </li>
  )
}
