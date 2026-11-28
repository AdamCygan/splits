import { useEffect } from 'react'

const OPEN_EVENT = 'ph:workspace-new'

/** Otwiera okno „Nowa przestrzeń” z dowolnego miejsca (przełącznik, paleta, ustawienia). */
export function openNewWorkspace() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

/** Nasłuch na prośby o otwarcie okna nowej przestrzeni. */
export function useNewWorkspaceRequests(onOpen: () => void) {
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [onOpen])
}
