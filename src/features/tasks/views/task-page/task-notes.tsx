import { CheckableNote } from '#/components/note/note-markdown'
import { Badge } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { taskNotes } from '#/features/tasks/domain/task-insights'
import { useFormat, useMessages } from '#/i18n/context'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from '../../controllers/use-task'

export interface TaskNotesProps {
  viewModel: TaskViewModel
}

/** Notatki z sesji, z nadgodzinami i przedłużeniami, od najstarszej. */
export function TaskNotes({ viewModel }: TaskNotesProps) {
  const messages = useMessages(taskViewMessages).notes
  const format = useFormat()
  const notes = taskNotes(viewModel.sessions)
  return (
    <Panel title={messages.title}>
      {notes.length === 0 ? (
        <p className="text-sm text-ink-soft">{messages.empty}</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((taskNote) => (
            <li key={taskNote.id} className="text-sm">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft tabular-nums">
                <span>{format.day(taskNote.date)}</span>
                {/* Godziny sesji, w której powstała notatka. */}
                <span>
                  {format.session(
                    taskNote.start,
                    taskNote.end,
                    taskNote.minutes,
                  )}
                </span>
                {taskNote.kind !== 'note' && (
                  <Badge tone="muted">{messages[taskNote.kind]}</Badge>
                )}
              </p>
              {taskNote.kind === 'note' ? (
                <CheckableNote
                  className="mt-0.5"
                  text={taskNote.text}
                  headingLevel={3}
                  onSave={(note) => viewModel.saveNote(taskNote.entryId, note)}
                />
              ) : (
                <p className="mt-0.5 whitespace-pre-line">{taskNote.text}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
