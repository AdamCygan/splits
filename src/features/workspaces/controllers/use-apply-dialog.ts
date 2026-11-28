import { useCallback, useState } from 'react'
import type { ApplyKind, ApplyTarget } from '../domain/workspaces'
import { useApplyRequests } from './apply-scope'
import type { ApplyRequest } from './apply-scope'
import { useSavePrefs, useWorkspaces } from './use-workspaces'

/**
 * Okno „Zastosować we wszystkich przestrzeniach?”: wybór, zapamiętanie wyboru dla tego
 * rodzaju zmian i odpowiedź dla mutacji, która czeka na decyzję.
 */
export function useApplyDialog() {
  const { items, current } = useWorkspaces()
  const savePrefs = useSavePrefs()
  const [request, setRequest] = useState<ApplyRequest | null>(null)
  const [choice, setChoice] = useState<ApplyTarget>('this')
  const [remember, setRemember] = useState(false)

  useApplyRequests(
    useCallback((next: ApplyRequest) => {
      setChoice('this')
      setRemember(false)
      setRequest(next)
    }, []),
  )

  const finish = (target: ApplyTarget | null) => {
    if (!request) return
    if (target && remember)
      savePrefs.mutate({ apply: { [request.kind]: target } })
    request.resolve(target)
    setRequest(null)
  }

  return {
    kind: request?.kind ?? null,
    open: request !== null,
    count: items.length,
    currentName: current?.name ?? '',
    choice,
    setChoice,
    remember,
    setRemember,
    confirm: () => finish(choice),
    cancel: () => finish(null),
  }
}

export type ApplyDialogModel = ReturnType<typeof useApplyDialog>
export type { ApplyKind }
