import { CheckableNote } from '#/components/note/note-markdown'
import { Badge } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { taskNotes } from '#/domain/task-insights'
import { useFormat, useMessages } from '#/i18n/context'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from './use-task'

/** Notatki z sesji, z nadgodzinami i przedłużeniami, od najstarszej. */
export function TaskNotes({ vm }: { vm: TaskViewModel }) {
  const t = useMessages(taskViewMessages).notes
  const format = useFormat()
  const notes = taskNotes(vm.sessions)
  return (
    <Panel title={t.title}>
      {notes.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft tabular-nums">
                <span>{format.day(n.date)}</span>
                {/* Godziny sesji, w której powstała notatka. */}
                <span>{format.session(n.start, n.end, n.minutes)}</span>
                {n.kind !== 'note' && <Badge tone="muted">{t[n.kind]}</Badge>}
              </p>
              {n.kind === 'note' ? (
                <CheckableNote
                  className="mt-0.5"
                  text={n.text}
                  headingLevel={3}
                  onSave={(note) => vm.saveNote(n.entryId, note)}
                />
              ) : (
                <p className="mt-0.5 whitespace-pre-line">{n.text}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
