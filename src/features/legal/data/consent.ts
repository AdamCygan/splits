import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

/**
 * Zgoda na cookies. „necessary” = tylko niezbędne, „analytics” = także statystyki (PostHog).
 * Wybór trzymamy w ciasteczku, więc SSR wie, czy pokazać baner (bez migotania i błędów hydracji).
 * Zmiana wersji (v1 → v2) ponownie pyta o zgodę, np. po dodaniu nowej kategorii.
 */
export const CONSENT_COOKIE = 'app_consent'
const VERSION = 'v1'
const MAX_AGE = 60 * 60 * 24 * 365 // 12 miesięcy

export type Consent = 'necessary' | 'analytics'

const parse = (raw: string | undefined): Consent | null => {
  const [version, value] = (raw ?? '').split(':')
  if (version !== VERSION) return null
  return value === 'analytics' || value === 'necessary' ? value : null
}

export const getConsent = createIsomorphicFn()
  .server((): Consent | null => parse(getCookie(CONSENT_COOKIE)))
  .client((): Consent | null => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`),
    )
    return parse(match ? decodeURIComponent(match[1] ?? '') : undefined)
  })

export function persistConsent(value: Consent) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${VERSION}:${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`
}
