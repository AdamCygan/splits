import { useResumeTask } from '../controllers/use-timer'
import { refOf, useFinishTask } from '../controllers/use-unfinished'
import { unfinishedQuery } from '../data/queries'
import { TaskProgress } from './task-progress'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { projectsQuery } from '#/features/projects/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { TaskLink } from '#/features/tasks/views/task-link'
import type { UnfinishedTask } from '#/features/time-entries/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { addDays } from '#/shared/domain/dates'
import { Check, Play } from 'lucide-react'

export interface UnfinishedTasksProps {
  today: string
}

/**
 * „Dokończ to, co zacząłeś”: niezakończone zadania z poprzednich dni na górze Dziś.
 * „Kontynuuj” startuje nową sesję (jak „Wznów”), „Zakończone” zdejmuje zadanie z listy.
 */
export function UnfinishedTasks({ today }: UnfinishedTasksProps) {
  const messages = useMessages(entriesMessages)
  const tasks = useQuery(unfinishedQuery).data ?? []
  const resume = useResumeTask()
  const finish = useFinishTask()
  const busy = resume.isPending || finish.isPending

  if (tasks.length === 0) return null
  return (
    <section
      aria-labelledby="unfinished-tasks"
      className="mb-6 rounded-2xl border border-line bg-surface"
    >
      <header className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="unfinished-tasks" className="type-heading text-xl">
          {messages.unfinished.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{messages.unfinished.lead}</p>
      </header>
      <ul className="divide-y divide-line">
        {tasks.map((task) => (
          <UnfinishedRow
            key={task.entry.id}
            task={task}
            today={today}
            busy={busy}
            onContinue={() => resume.mutate(task.entry.id)}
            onFinish={() =>
              finish.mutate({ ref: refOf(task.entry), finished: true })
            }
          />
        ))}
      </ul>
    </section>
  )
}

interface UnfinishedRowProps {
  task: UnfinishedTask
  today: string
  busy: boolean
  onContinue: () => void
  onFinish: () => void
}

function UnfinishedRow({
  task,
  today,
  busy,
  onContinue,
  onFinish,
}: UnfinishedRowProps) {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const { entry } = task
  const type = types.find((workType) => workType.id === entry.taskTypeId)
  const project = projects.find((candidate) => candidate.id === entry.projectId)
  const when =
    task.lastDate === addDays(today, -1)
      ? messages.day.yesterday
      : format.day(task.lastDate)

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <span
          aria-hidden
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ background: type?.color ?? 'var(--ink-faint)' }}
        />
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="font-semibold break-words">
            <TaskLink task={entry}>{entry.title}</TaskLink>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <span>{type?.name}</span>
            <span aria-hidden>·</span>
            <span>{fmt(messages.unfinished.lastWorked, { date: when })}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {fmt(messages.unfinished.worked, {
                time: format.minutes(task.workedMinutes),
                sessions: format.plural(
                  messages.unfinished.sessions,
                  task.sessions,
                ),
              })}
            </span>
            {project && (
              <Badge tone="muted">{project.key ?? project.name}</Badge>
            )}
          </p>
          <TaskProgress entry={entry} />
        </div>
        <div className="flex shrink-0 gap-2 max-sm:w-full max-sm:pl-5.5">
          <Button
            size="sm"
            disabled={busy}
            onClick={onContinue}
            aria-label={fmt(messages.unfinished.continueNamed, {
              name: entry.title,
            })}
          >
            <Play aria-hidden className="size-4" />
            {messages.unfinished.continue}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onFinish}
            aria-label={fmt(messages.unfinished.finishNamed, {
              name: entry.title,
            })}
          >
            <Check aria-hidden className="size-4" />
            {messages.unfinished.finish}
          </Button>
        </div>
      </div>
    </li>
  )
}
