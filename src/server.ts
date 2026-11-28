import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { registerNonceStore } from '#/lib/csp-nonce'
import { environment } from '#/lib/env'
import {
  PAGE_SECURITY_HEADERS,
  contentSecurityPolicy,
} from '#/server/security-headers'

/**
 * Własny punkt wejścia serwera SSR:
 *  - kompresuje HTML/JSON/XML gzipem (pliki statyczne Nitro ma już skompresowane wcześniej),
 *  - dodaje nagłówki bezpieczeństwa, a stronom HTML Content-Security-Policy z nonce'em
 *    (nonce trafia do routera przez currentNonce() z #/lib/csp-nonce).
 * Za reverse proxy (Caddy, nginx, ingress w Kubernetesie) to też działa —
 * proxy po prostu przekaże już skompresowaną odpowiedź.
 */
const COMPRESSIBLE =
  /^(text\/|application\/(json|xml|javascript|manifest\+json|ld\+json)|image\/svg\+xml)/

const nonces = new AsyncLocalStorage<string>()
registerNonceStore(nonces)

/** Vite w trybie dev wstrzykuje własne skrypty bez nonce'a, więc CSP tylko w buildzie. */
const enforceCsp = import.meta.env.PROD

function finalize(
  request: Request,
  response: Response,
  nonce: string,
): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(PAGE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value)
  }

  const type = headers.get('content-type') ?? ''
  if (enforceCsp && type.startsWith('text/html'))
    headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy({
        nonce,
        apiUrl: environment.VITE_API_URL,
        posthogHost: environment.VITE_POSTHOG_KEY
          ? (environment.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com')
          : undefined,
      }),
    )
  const acceptsGzip = /\bgzip\b/.test(
    request.headers.get('accept-encoding') ?? '',
  )
  const body = response.body
  const canCompress =
    acceptsGzip &&
    !headers.has('content-encoding') &&
    COMPRESSIBLE.test(type) &&
    request.method !== 'HEAD'

  if (!canCompress || body === null) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  headers.set('content-encoding', 'gzip')
  headers.delete('content-length')
  headers.append('vary', 'Accept-Encoding')
  return new Response(body.pipeThrough(new CompressionStream('gzip')), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default createServerEntry({
  async fetch(request, ...rest) {
    const nonce = randomBytes(16).toString('base64')
    const response = await nonces.run(nonce, () =>
      handler.fetch(request, ...rest),
    )
    return finalize(request, response, nonce)
  },
})
