import { useEffect } from 'react'

/** Ostrzega przed opuszczeniem strony z niezapisanymi zmianami (zamknięcie karty). */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (beforeUnloadEvent: BeforeUnloadEvent) => {
      beforeUnloadEvent.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
