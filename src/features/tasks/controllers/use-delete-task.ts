import { entriesApi } from '#/features/time-entries/data/api'
import type { TaskRef } from '#/features/time-entries/data/dto'
import { entryKeys } from '#/features/time-entries/data/queries'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'

export interface DeleteTaskOptions {
  /** Tylko sesje z tego dnia; null = całe zadanie z historii. */
  date: string | null
  title: string
  onDeleted: () => void
}

/** Usunięcie sesji zadania (z jednego dnia albo wszystkich). */
export function useDeleteTask({ date, title, onDeleted }: DeleteTaskOptions) {
  const t = useMessages(entriesMessages).deleteTask
  return useDataMutation((ref: TaskRef) => entriesApi.removeTask(ref, date), {
    invalidate: [entryKeys.all],
    success: () => fmt(t.deleted, { name: title }),
    onSuccess: onDeleted,
  })
}
