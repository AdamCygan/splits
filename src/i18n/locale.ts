import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { LOCALE_COOKIE, defaultLocale, isLocale } from './config'
import type { Locale } from './config'

/**
 * Bieżący język: z ciasteczka, a bez niego angielski.
 * Na serwerze czytamy ciasteczko z żądania, w przeglądarce z document.cookie —
 * dzięki temu SSR i hydracja renderują ten sam język (brak migotania i błędów hydracji).
 * Nie zgadujemy z Accept-Language: wyszukiwarki zawsze widzą wersję angielską.
 */
export const getLocale = createIsomorphicFn()
  .server((): Locale => {
    const value = getCookie(LOCALE_COOKIE)
    return isLocale(value) ? value : defaultLocale
  })
  .client((): Locale => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
    )
    const value = match ? decodeURIComponent(match[1] ?? '') : undefined
    return isLocale(value) ? value : defaultLocale
  })

export function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
}
