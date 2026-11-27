import { useQuery } from '@tanstack/react-query'
import { Check, Play } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { data } from '#/data'
import type { TaskRef, TimeEntry, UnfinishedTask } from '#/data/types'
import { addDays } from '#/domain/dates'
import { TaskLink } from '#/features/tasks/task-link'
import {
  projectsQuery,
  taskTypesQuery,
  useDataMutation,
} from '#/features/settings/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { entryKeys, unfinishedQuery } from '../queries'
import { TaskProgress } from './task-progress'
import { useResumeTask } from './timer'

const refOf = (e: TimeEntry): TaskRef => ({
  title: e.title,
  link: e.link,
  taskTypeId: e.taskTypeId,
})

/** Zakończone / z powrotem w toku: wszystkie sesje zadania naraz. */
export function useFinishTask() {
  const t = useMessages(entriesMessages).unfinished
  return useDataMutation(
    ({ ref, finished }: { ref: TaskRef; finished: boolean }) =>
      data.entries.finishTask(ref, finished),
    {
      invalidate: [entryKeys.all],
      success: (_, { ref, finished }) =>
        fmt(finished ? t.finished : t.reopened, { name: ref.title }),
    },
  )
}

/**
 * „Dokończ to, co zacząłeś”: niezakończone zadania z poprzednich dni na górze Dziś.
 * „Kontynuuj” startuje nową sesję (jak „Wznów”), „Zakończone” zdejmuje zadanie z listy.
 */
export function UnfinishedTasks({ today }: { today: string }) {
  const t = useMessages(entriesMessages)
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
          {t.unfinished.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.unfinished.lead}</p>
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

function UnfinishedRow({
  task,
  today,
  busy,
  onContinue,
  onFinish,
}: {
  task: UnfinishedTask
  today: string
  busy: boolean
  onContinue: () => void
  onFinish: () => void
}) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const { entry } = task
  const type = types.find((x) => x.id === entry.taskTypeId)
  const project = projects.find((p) => p.id === entry.projectId)
  const when =
    task.lastDate === addDays(today, -1)
      ? t.day.yesterday
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
            <span>{fmt(t.unfinished.lastWorked, { date: when })}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {fmt(t.unfinished.worked, {
                time: format.minutes(task.workedMinutes),
                sessions: format.plural(t.unfinished.sessions, task.sessions),
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
            aria-label={fmt(t.unfinished.continueNamed, { name: entry.title })}
          >
            <Play aria-hidden className="size-4" />
            {t.unfinished.continue}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onFinish}
            aria-label={fmt(t.unfinished.finishNamed, { name: entry.title })}
          >
            <Check aria-hidden className="size-4" />
            {t.unfinished.finish}
          </Button>
        </div>
      </div>
    </li>
  )
}
