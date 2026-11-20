import { data } from '#/data'
import { useDataMutation } from '#/features/settings/queries'
import { entryKeys } from './queries'

/** Zapis samej notatki wpisu (odhaczony checkbox na liście albo na stronie zadania). */
export function useUpdateNote() {
  return useDataMutation(
    ({ id, note }: { id: string; note: string }) =>
      data.entries.updateNote(id, note),
    { invalidate: [entryKeys.all] },
  )
}
