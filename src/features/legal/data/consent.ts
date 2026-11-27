import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE as MAX_AGE,
  CONSENT_VERSION as VERSION,
  parseConsent as parse,
} from '../domain/consent'
import type { Consent } from '../domain/consent'

/** Wybór trzymamy w ciasteczku, więc SSR wie, czy pokazać baner (bez migotania i błędów hydracji). */
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
