import type { QueryKey } from '@tanstack/react-query'
import type { R } from '#/shared/data/http'
import { fmt } from '#/i18n/format'
import { useDataMutation } from '../data/mutations'

interface Named {
  id: string
  name: string
}

export interface ArchiveOptions {
  invalidate: QueryKey
  messages: { archived: string; restored: string }
}

/**
 * Archiwizacja i przywracanie pozycji ustawień (rodzaje pracy, projekty, statusy):
 * jedna mutacja z odświeżeniem listy i komunikatem „Zarchiwizowano/Przywrócono {name}”.
 */
export function useArchive<TData>(
  setArchived: (id: string, archived: boolean) => R<TData>,
  options: ArchiveOptions,
) {
  const mutation = useDataMutation(
    ({ id, archived }: Named & { archived: boolean }) =>
      setArchived(id, archived),
    {
      invalidate: [options.invalidate],
      success: (_r, v) =>
        fmt(
          v.archived ? options.messages.archived : options.messages.restored,
          { name: v.name },
        ),
    },
  )
  return {
    pending: mutation.isPending,
    archive: ({ id, name }: Named) =>
      mutation.mutate({ id, name, archived: true }),
    restore: ({ id, name }: Named) =>
      mutation.mutate({ id, name, archived: false }),
  }
}
