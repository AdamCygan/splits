import { entriesApi } from '../data/api'
import { useDataMutation } from '#/shared/data/mutations'
import { entryKeys } from '../data/queries'

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
