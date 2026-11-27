import { entriesApi } from './data/api'
import { useDataMutation } from '#/features/settings/queries'
import { entryKeys } from './queries'

export interface NoteUpdate {
  id: string
  note: string
}

/** Zapis samej notatki wpisu (odhaczony checkbox na liście albo na stronie zadania). */
export function useUpdateNote() {
  return useDataMutation(
    ({ id, note }: NoteUpdate) => entriesApi.updateNote(id, note),
    { invalidate: [entryKeys.all] },
  )
}
