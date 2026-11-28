import { useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveApply } from '../domain/workspaces'
import type { ApplyKind, ApplyTarget } from '../domain/workspaces'
import { workspacesQuery } from '../data/queries'

const ASK_EVENT = 'ph:apply-ask'

export interface ApplyRequest {
  kind: ApplyKind
  resolve: (target: ApplyTarget | null) => void
}

interface AskDetail extends ApplyRequest {
  handled: boolean
}

/**
 * Pyta (oknem), czy zmiana ma trafić tylko do bieżącej przestrzeni, czy do wszystkich.
 * null = użytkownik zrezygnował. Bez okna na stronie (np. w testach) zostaje bieżąca.
 */
export function askApply(kind: ApplyKind) {
  return new Promise<ApplyTarget | null>((resolve) => {
    const detail: AskDetail = { kind, resolve, handled: false }
    window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail }))
    if (!detail.handled) resolve('this')
  })
}

/** Nasłuch pytań „gdzie zastosować” (okno w układzie panelu). */
export function useApplyRequests(onAsk: (request: ApplyRequest) => void) {
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AskDetail>).detail
      detail.handled = true
      onAsk({ kind: detail.kind, resolve: detail.resolve })
    }
    window.addEventListener(ASK_EVENT, listener)
    return () => window.removeEventListener(ASK_EVENT, listener)
  }, [onAsk])
}

/**
 * Gdzie trafi zmiana danego rodzaju: jedna przestrzeń albo zapamiętany wybór rozstrzygają
 * od razu, w przeciwnym razie pytamy. null = zmiana anulowana.
 */
export function useApplyTarget() {
  const { data } = useQuery(workspacesQuery)
  return useCallback(
    async (kind: ApplyKind): Promise<ApplyTarget | null> => {
      if (!data) return 'this'
      return (
        resolveApply(data.prefs.apply, kind, data.items.length) ??
        askApply(kind)
      )
    },
    [data],
  )
}
