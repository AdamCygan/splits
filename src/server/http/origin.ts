export interface RequestOrigin {
  origin: string | undefined
  /** Nagłówek Sec-Fetch-Site (przeglądarki od 2020 r.). */
  fetchSite: string | undefined
  requestUrl: string
  /** Publiczny adres aplikacji (APP_URL), gdy proxy zmienia adres żądania. */
  appUrl: string
}

/**
 * Ścieżki z ciasteczkiem sesji (/auth/*): przyjmujemy je tylko z naszej własnej strony
 * (ochrona przed CSRF). Przeglądarki wysyłają Origin i Sec-Fetch-Site; brak obu oznacza
 * klienta spoza przeglądarki (testy, curl), który i tak nie ma cudzego ciasteczka.
 */
export function sameOrigin({
  origin,
  fetchSite,
  requestUrl,
  appUrl,
}: RequestOrigin) {
  if (fetchSite === 'cross-site') return false
  if (!origin) return true
  return (
    origin === new URL(requestUrl).origin || origin === new URL(appUrl).origin
  )
}
