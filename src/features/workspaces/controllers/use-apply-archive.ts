import type { QueryKey } from '@tanstack/react-query'
import { fmt } from '#/i18n/format'
import type { ApplyTo, R } from '#/shared/data/http'
import type { ApplyKind } from '../domain/workspaces'
import { useApplyMutation } from './use-apply-mutation'

interface Named {
  id: string
  name: string
}

export interface ApplyArchiveOptions {
  invalidate: QueryKey
  messages: { archived: string; restored: string }
}

/**
 * Archiwizacja i przywracanie (rodzaje pracy, statusy), które mogą trafić do wszystkich
 * przestrzeni: jak useArchive, ale najpierw ustala, gdzie zastosować zmianę.
 */
export function useApplyArchive<TData>(
  kind: ApplyKind,
  setArchived: (id: string, archived: boolean, apply?: ApplyTo) => R<TData>,
  options: ApplyArchiveOptions,
) {
  const mutation = useApplyMutation(
    kind,
    ({ id, archived }: Named & { archived: boolean }, apply) =>
      setArchived(id, archived, apply),
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
