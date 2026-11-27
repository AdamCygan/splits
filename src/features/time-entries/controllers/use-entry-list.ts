import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { entriesApi } from '../data/api'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { extractTaskKey } from '#/features/task-types/domain/rules'
import { dayTaskGroups } from '#/features/tasks/domain/task-groups'
import type { DayTaskGroup } from '#/features/tasks/domain/task-groups'
import { projectsQuery } from '#/features/projects/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { useDataMutation } from '#/shared/data/mutations'
import { useMessages } from '#/i18n/context'
import { entriesMessages } from '#/i18n/messages/entries'
import { entryKeys } from '../data/queries'
import { useUpdateNote } from './use-update-note'
import { usePauseTimer, useResumeTask, useStopTimer } from './use-timer'

/** Okno otwarte z listy dnia (jedno naraz). */
export type EntryListDialog =
  | { kind: 'edit'; entry: TimeEntry; notes: boolean }
  | { kind: 'duplicate'; entry: TimeEntry }
  | { kind: 'extend'; entry: TimeEntry }
  | { kind: 'summary'; entry: TimeEntry }
  | { kind: 'delete'; entry: TimeEntry }
  | { kind: 'deleteTask'; group: DayTaskGroup }

/**
 * ViewModel listy wpisów dnia: zadania z sesjami (domain/task-groups), ich typ, projekt
 * i numer ticketu, okna (edycja, kopia, przedłużenie, podsumowanie, usuwanie) oraz akcje
 * timera. Widoki kart i sesji tylko wywołują `open(...)` i akcje.
 */
export function useEntryListViewModel(entries: ReadonlyArray<TimeEntry>) {
  const t = useMessages(entriesMessages)
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const [dialog, setDialog] = useState<EntryListDialog | null>(null)
  const close = () => setDialog(null)

  const remove = useDataMutation((id: string) => entriesApi.remove(id), {
    invalidate: [entryKeys.all],
    success: t.list.deleted,
    onSuccess: close,
  })
  const updateNote = useUpdateNote()
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTask()

  const typeOf = (id: string) => types.find((x) => x.id === id)
  const tasks = dayTaskGroups(entries).map((group) => {
    const type = typeOf(group.latest.taskTypeId)
    return {
      ...group,
      type,
      project: projects.find((p) => p.id === group.latest.projectId),
      taskKey: group.latest.link ? extractTaskKey(group.latest.link) : null,
      isMeeting: type?.kind === 'meeting',
      canNote: type?.descriptionRequirement !== 'hidden',
    }
  })

  return {
    tasks,
    dialog,
    open: setDialog,
    close,
    typeOf,
    timerBusy: stop.isPending || pause.isPending || resume.isPending,
    removing: remove.isPending,
    pause: (entry: TimeEntry) => pause.mutate(entry.id),
    stop: (entry: TimeEntry) => stop.mutate(entry.id),
    resume: (entry: TimeEntry) => resume.mutate(entry.id),
    removeEntry: (entry: TimeEntry) => remove.mutate(entry.id),
    saveNote: (entry: TimeEntry, note: string) =>
      updateNote.mutateAsync({ id: entry.id, note }),
  }
}

export type EntryListViewModel = ReturnType<typeof useEntryListViewModel>
export type DayTask = EntryListViewModel['tasks'][number]
