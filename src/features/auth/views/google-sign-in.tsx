import { useEffect, useState } from 'react'
import { authApi } from '../data/api'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { cn } from '#/lib/utils'

/** Logo Google w oficjalnych kolorach (wymóg wytycznych marki przy przycisku logowania). */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

export interface GoogleSignInProps {
  redirectTo?: string
  className?: string
}

/**
 * „Kontynuuj z Google”: zwykły link do /api/v1/auth/google (pełne przekierowanie, bez okienek).
 * Pokazujemy go tylko, gdy serwer ma ustawione GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET.
 */
export function GoogleSignIn({ redirectTo, className }: GoogleSignInProps) {
  const t = useMessages(authMessages)
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    void authApi.providers().then((result) => {
      if (active) setEnabled(result.ok && result.value.google)
    })
    return () => {
      active = false
    }
  }, [])
  if (!enabled) return null

  const params = new URLSearchParams({
    redirect: redirectTo ?? '/app',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })
  return (
    <div className={className}>
      <div className="mb-5 flex items-center gap-3 text-sm text-ink-soft">
        <span aria-hidden className="h-px flex-1 bg-line" />
        {t.or}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <a
        href={`/api/v1/auth/google?${params.toString()}`}
        className={cn(
          'flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-input bg-surface px-4 text-base font-medium shadow-xs hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        )}
      >
        <GoogleMark />
        {t.google}
      </a>
    </div>
  )
}
