import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Dostępność nawigacji w SPA: po przejściu na nową stronę czytnik ekranu ogłasza
 * jej tytuł, a fokus wraca na początek treści (#main), tak jak przy zwykłym przeładowaniu.
 */
export function RouteAnnouncer() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    return router.subscribe('onResolved', ({ toLocation, pathChanged }) => {
      const path = toLocation.pathname
      if (lastPath.current === null) {
        lastPath.current = path
        return
      }
      if (!pathChanged || lastPath.current === path) return
      lastPath.current = path
      // Tytuł ustawia HeadContent; dajemy mu jedną klatkę.
      requestAnimationFrame(() => {
        setMessage(document.title)
        if (!toLocation.hash)
          document.getElementById('main')?.focus({ preventScroll: true })
      })
    })
  }, [router])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
