/**
 * Nagłówki bezpieczeństwa stron (SSR). API ma swoje w src/server/app.ts (secureHeaders z Hono).
 *
 * Content-Security-Policy działa na nonce: każdy skrypt wstawiony przez serwer (hydracja
 * TanStacka, skrypt motywu, JSON-LD) dostaje nonce z bieżącego żądania, a wstrzyknięty
 * skrypt bez niego się nie wykona. Style zostają z 'unsafe-inline', bo React i Radix
 * ustawiają atrybuty style, a te nie obsługują nonce'ów.
 */

export interface CspOptions {
  nonce: string
  /** Adres API, gdy jest pod inną domeną niż strona (VITE_API_URL). */
  apiUrl?: string
  /** PostHog: host API (VITE_POSTHOG_HOST), tylko gdy analityka jest włączona. */
  posthogHost?: string
}

const origin = (url: string | undefined) => {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Skrypty rozszerzeń PostHoga (ankiety, nagrania) leżą pod osobnym hostem „-assets”. */
export function posthogAssetsOrigin(host: string) {
  const match = /^https:\/\/(eu|us)\.i\.posthog\.com$/.exec(host)
  return match ? `https://${match[1]}-assets.i.posthog.com` : null
}

export function contentSecurityPolicy({
  nonce,
  apiUrl,
  posthogHost,
}: CspOptions): string {
  const api = origin(apiUrl)
  const posthog = origin(posthogHost)
  const posthogAssets = posthog ? posthogAssetsOrigin(posthog) : null
  const list = (...values: Array<string | null>) =>
    values.filter((part): part is string => part !== null).join(' ')

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': list("'self'", `'nonce-${nonce}'`, posthogAssets),
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: blob: https:",
    'font-src': "'self' data:",
    'media-src': "'self'",
    'connect-src': list("'self'", api, posthog, posthogAssets),
    'worker-src': "'self' blob:",
    'manifest-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
    'frame-src': "'none'",
  }
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ')
}

export const PAGE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // Przeglądarki biorą HSTS tylko z odpowiedzi po HTTPS, więc na localhost nic nie zmienia.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), usb=(), payment=(self), interest-cohort=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
}
