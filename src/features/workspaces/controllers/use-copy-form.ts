import { useState } from 'react'
import type { Workspace } from '../data/dto'
import { COPY_KINDS, DEFAULT_COPY } from '../domain/workspaces'
import type { CopyKind } from '../domain/workspaces'
import { useWorkspaceActions, useWorkspaces } from './use-workspaces'

export interface CopyFormOptions {
  /** Przestrzeń, do której kopiujemy. */
  target: Workspace
  onDone: () => void
}

/** „Kopiuj z innej przestrzeni”: źródło i rzeczy do skopiowania. */
export function useCopyForm({ target, onDone }: CopyFormOptions) {
  const { items } = useWorkspaces()
  const { copy } = useWorkspaceActions()
  const sources = items.filter((item) => item.id !== target.id)
  const [from, setFrom] = useState(sources[0]?.id ?? '')
  const [kinds, setKinds] = useState<Array<CopyKind>>([...DEFAULT_COPY])
  return {
    sources,
    from,
    setFrom,
    kinds,
    setKinds,
    copyKinds: COPY_KINDS,
    pending: copy.isPending,
    canSubmit: from !== '' && kinds.length > 0,
    submit: () => {
      if (!from || kinds.length === 0) return
      copy.mutate({ to: target, from, kinds }, { onSuccess: onDone })
    },
  }
}
