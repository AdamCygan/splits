import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { entriesApi } from '#/features/time-entries/data/api'
import type { TaskRef, TimeEntry } from '#/features/time-entries/data/dto'
import { maxEstimate, maxPoints } from '#/features/tasks/domain/summary'
import { taskInsights } from '#/features/tasks/domain/task-insights'
import { projectsQuery } from '#/features/projects/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import {
  taskQueryKey,
  rangeEntriesQuery,
} from '#/features/time-entries/data/queries'
import { useResumeTask } from '#/features/time-entries/controllers/use-timer'
import { useFinishTask } from '#/features/time-entries/controllers/use-unfinished'
import { useUpdateNote } from '#/features/time-entries/controllers/use-update-note'
import { unwrap } from '#/lib/api-client'

export interface TaskPageProps {
  task: TaskRef
  /** Po zmianie tytułu albo linku zadanie ma nowy adres strony. */
  onRename: (ref: TaskRef) => void
}

/**
 * ViewModel strony zadania: sesje zadania, wpisy z tych samych dni (do osi i przerw),
 * statystyki z domain/task-insights oraz akcje (zakończ, wznów, podsumowanie, notatki).
 */
export function useTaskViewModel({ task, onRename }: TaskPageProps) {
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const sessions = useQuery({
    queryKey: taskQueryKey(task),
    queryFn: () => unwrap(entriesApi.forTask(task)),
  })
  const list = sessions.data ?? []
  const first = list[0]?.workDate
  const last = list.at(-1)?.workDate
  const sameDays =
    useQuery({
      ...rangeEntriesQuery(first ?? '', last ?? ''),
      enabled: !!first && !!last,
    }).data ?? list
  const finish = useFinishTask()
  const resume = useResumeTask()
  const updateNote = useUpdateNote()
  const [summarizing, setSummarizing] = useState(false)

  const latest = list.at(-1)
  const type = types.find((workType) => workType.id === task.taskTypeId)
  const finishedAt = list.find((entry) => entry.finishedAt)?.finishedAt ?? null
  const insights = taskInsights(list, sameDays)
  const estimate = maxEstimate(list)

  return {
    task,
    pending: sessions.isPending,
    sessions: list,
    sameDays,
    latest,
    insights,
    types,
    type,
    color: type?.color ?? 'var(--wt-custom)',
    project: projects.find((project) => project.id === latest?.projectId),
    sp: maxPoints(list),
    estimate,
    /** Czas ponad estymatę (ujemny = poniżej, 0 = bez estymaty). */
    overEstimate:
      estimate === null || !insights ? 0 : insights.minutes - estimate,
    finishedAt,
    finishing: finish.isPending,
    resuming: resume.isPending,
    summarizing,
    typeOf: (id: string) => types.find((workType) => workType.id === id),
    // akcje
    toggleFinished: () =>
      finish.mutate({ ref: task, finished: finishedAt === null }),
    resume: () => latest && resume.mutate(latest.id),
    openSummary: () => setSummarizing(true),
    closeSummary: () => setSummarizing(false),
    saveNote: (id: string, note: string) =>
      updateNote.mutateAsync({ id, note }),
    /** Zapis szczegółów zmienia tytuł albo link, więc i adres strony. */
    saved: (entries: ReadonlyArray<TimeEntry>) => {
      const next = entries.at(-1)
      if (next)
        onRename({
          title: next.title,
          link: next.link,
          taskTypeId: next.taskTypeId,
        })
    },
  }
}

export type TaskViewModel = ReturnType<typeof useTaskViewModel>
