import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'
import { entriesApi } from '../data/api'
import type {
  TaskRef,
  TaskUpdateInput,
  TimeEntry,
  TimeEntryInput,
} from '../data/dto'
import { entryKeys } from '../data/queries'

export interface UpdateTaskOptions {
  task: TaskRef
  onSaved: (entries: Array<TimeEntry>) => void
}

/** Zmiana tytułu, linku, projektu i SP we wszystkich sesjach zadania. */
export function useUpdateTask({ task, onSaved }: UpdateTaskOptions) {
  const t = useMessages(entriesMessages).task
  return useDataMutation(
    (input: TaskUpdateInput) => entriesApi.updateTask(task, input),
    { invalidate: [entryKeys.all], success: t.saved, onSuccess: onSaved },
  )
}

/** Usunięcie jednej sesji zadania. */
export function useRemoveSession(onRemoved: () => void) {
  const t = useMessages(entriesMessages).task
  return useDataMutation((id: string) => entriesApi.remove(id), {
    invalidate: [entryKeys.all],
    success: t.deleted,
    onSuccess: onRemoved,
  })
}

export interface SaveExtensionOptions {
  entryId: string
  onSaved: () => void
}

/** Zapis dodatkowego czasu (spotkanie przeciągnęło się) albo jego usunięcie. */
export function useSaveExtension({ entryId, onSaved }: SaveExtensionOptions) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation(
    (input: TimeEntryInput) => entriesApi.update(entryId, input),
    {
      invalidate: [entryKeys.all],
      success: (saved) =>
        saved.extensionMinutes === null
          ? t.extension.removed
          : fmt(t.extension.saved, {
              time: format.minutes(saved.extensionMinutes),
              name: saved.title,
            }),
      onSuccess: onSaved,
    },
  )
}
