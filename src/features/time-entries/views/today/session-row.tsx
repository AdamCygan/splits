import { Copy, NotebookPen, Pencil, TimerReset, Trash2 } from 'lucide-react'
import { ActionMenu } from '#/components/ui/action-menu'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'
import { formatClock } from '../../domain/clock'
import { useElapsed } from '../../controllers/use-timer'
import { Notes } from './notes'
import type {
  DayTask,
  EntryListViewModel,
} from '../../controllers/use-entry-list'

interface RunningClockProps {
  entry: TimeEntry
}

/** Czas działającego odcinka (role="timer", bez ogłaszania co sekundę). */
function RunningClock({ entry }: RunningClockProps) {
  const seconds = useElapsed(entry)
  return <span role="timer">{formatClock(seconds)}</span>
}

export interface SessionRowProps {
  entry: TimeEntry
  task: DayTask
  viewModel: EntryListViewModel
}

/**
 * Jedna sesja zadania: godziny od–do (albo sam czas, gdy wpisano bez godzin), znaczniki
 * nadgodzin i przedłużenia, edycja, menu „⋯” i notatki pod spodem.
 */
export function SessionRow({ entry, task, viewModel }: SessionRowProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const interval =
    entry.startTime && (entry.endTime || entry.running)
      ? entry.endTime
        ? format.timeRange(entry.startTime, entry.endTime)
        : `${format.time(entry.startTime)}–…`
      : null
  const label = fmt(messages.list.sessionLabel, {
    name: entry.title,
    interval: interval ?? format.minutes(entry.durationMinutes),
  })
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {interval && (
          <span className="text-sm font-medium tabular-nums">{interval}</span>
        )}
        <span
          className={cn(
            'text-sm tabular-nums',
            interval ? 'text-ink-soft' : 'font-medium',
          )}
        >
          {entry.running ? (
            <RunningClock entry={entry} />
          ) : (
            format.minutes(entry.durationMinutes)
          )}
        </span>
        {entry.overtimeMinutes !== null && (
          <Badge tone="warning">
            {fmt(messages.form.overtime.badge, {
              time: format.minutes(entry.overtimeMinutes),
            })}
          </Badge>
        )}
        {entry.extensionMinutes !== null && (
          <Badge tone="muted">
            {fmt(messages.extension.badge, {
              time: format.minutes(entry.extensionMinutes),
            })}
          </Badge>
        )}
        <span className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={app.actions.edit}
            aria-label={`${app.actions.edit}: ${label}`}
            onClick={() =>
              viewModel.open({ kind: 'edit', entry, notes: false })
            }
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <ActionMenu
            title={messages.list.more}
            label={`${messages.list.more}: ${label}`}
            actions={[
              !entry.note &&
                task.canNote && {
                  label: messages.list.addNotes,
                  icon: NotebookPen,
                  onSelect: () =>
                    viewModel.open({ kind: 'edit', entry, notes: true }),
                },
              task.isMeeting &&
                !entry.running && {
                  label: messages.extension.button,
                  icon: TimerReset,
                  onSelect: () => viewModel.open({ kind: 'extend', entry }),
                },
              !entry.running && {
                label: messages.list.duplicate,
                icon: Copy,
                onSelect: () => viewModel.open({ kind: 'duplicate', entry }),
              },
              {
                label: messages.list.deleteSession,
                icon: Trash2,
                destructive: true,
                onSelect: () => viewModel.open({ kind: 'delete', entry }),
              },
            ]}
          />
        </span>
      </div>
      {entry.note ? (
        <div className="mt-1.5 rounded-lg bg-muted/60 px-3.5 py-2.5">
          <p className="sr-only">{messages.list.notesLabel}:</p>
          <Notes
            text={entry.note}
            moreLabel={messages.list.showNotes}
            onSave={(note) => viewModel.saveNote(entry, note)}
          />
        </div>
      ) : null}
      {entry.extensionNote ? (
        <div className="mt-1.5 rounded-lg border-l-4 border-wt-meeting bg-wt-meeting/10 px-3.5 py-2.5">
          <p className="text-sm font-semibold">
            {messages.extension.listLabel}
          </p>
          <Notes
            text={entry.extensionNote}
            moreLabel={messages.list.showNotes}
          />
        </div>
      ) : null}
      {entry.overtimeNote ? (
        <div className="mt-1.5 rounded-lg border-l-4 border-wt-review bg-wt-review/10 px-3.5 py-2.5">
          <p className="text-sm font-semibold">
            {messages.form.overtime.listLabel}
          </p>
          <Notes
            text={entry.overtimeNote}
            moreLabel={messages.list.showNotes}
          />
        </div>
      ) : null}
    </li>
  )
}
