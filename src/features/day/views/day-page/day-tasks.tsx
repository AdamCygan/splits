import type { TimeEntry } from '#/features/time-entries/data/dto'
import { CheckableNote } from '#/components/note/note-markdown'
import { Badge, ColorDot } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { TaskLink } from '#/features/tasks/views/task-link'
import { useFormat, useMessages } from '#/i18n/context'
import { dayViewMessages } from '#/i18n/messages/day-view'
import type { DayViewModel } from '../../controllers/use-day'

export interface DayTasksProps {
  vm: DayViewModel
}

/** Zadania dnia od najdłuższego: czas, sesje z godzinami, SP i notatki z tego dnia. */
export function DayTasks({ vm }: DayTasksProps) {
  const t = useMessages(dayViewMessages).tasks
  const format = useFormat()
  const when = (s: Pick<TimeEntry, 'startTime' | 'endTime'>) =>
    s.startTime && s.endTime ? format.timeRange(s.startTime, s.endTime) : null
  return (
    <Panel title={t.title} lead={t.lead}>
      <ul className="divide-y divide-line">
        {vm.summary.tasks.map((row) => {
          const type = vm.typeOf(row.taskTypeId)
          const project = vm.projectOf(row.projectId)
          const sessions = vm.sessionsOf(row.key)
          return (
            <li key={row.key} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <ColorDot
                  className="mt-1.5"
                  color={vm.colorOf(row.taskTypeId)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="min-w-0 font-semibold break-words">
                      <TaskLink task={row}>{row.title}</TaskLink>
                    </h3>
                    <span className="font-semibold tabular-nums">
                      {format.minutes(row.minutes)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                    <span>{type?.name}</span>
                    {row.storyPoints !== null && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{format.sp(row.storyPoints)}</span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {format.plural(t.sessions, row.sessions)}:{' '}
                      {sessions.map((s) => when(s) ?? t.untimed).join(', ')}
                    </span>
                    {project && (
                      <Badge tone="muted">{project.key ?? project.name}</Badge>
                    )}
                  </p>
                  {sessions.map((s) => (
                    <div key={s.id} className="contents">
                      {s.note && (
                        <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2">
                          {/* Godziny sesji, w której powstała notatka. */}
                          <p className="mb-1 text-xs text-ink-soft tabular-nums">
                            {format.session(
                              s.startTime,
                              s.endTime,
                              s.durationMinutes,
                            )}
                          </p>
                          <CheckableNote
                            text={s.note}
                            headingLevel={4}
                            onSave={(note) => vm.saveNote(s.id, note)}
                          />
                        </div>
                      )}
                      {s.overtimeNote && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">{t.overtime}: </span>
                          {s.overtimeNote}
                        </p>
                      )}
                      {s.extensionNote && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">{t.extension}: </span>
                          {s.extensionNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
