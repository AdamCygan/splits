import { useEffect } from 'react'
import type { FeedbackKind } from '../domain/feedback'

const OPEN_EVENT = 'ph:feedback'

/** Otwiera okno „Zgłoś problem / pomysł” z dowolnego miejsca (menu, paleta, strona Pomoc). */
export function openFeedback(kind: FeedbackKind = 'bug') {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: kind }))
}

/** Nasłuch na prośby o otwarcie okna zgłoszenia. */
export function useFeedbackRequests(onOpen: (kind: FeedbackKind) => void) {
  useEffect(() => {
    const listener = (event: Event) =>
      onOpen((event as CustomEvent<FeedbackKind>).detail)
    window.addEventListener(OPEN_EVENT, listener)
    return () => window.removeEventListener(OPEN_EVENT, listener)
  }, [onOpen])
}
