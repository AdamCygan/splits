import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

/**
 * Własny punkt wejścia serwera SSR:
 *  - kompresuje HTML/JSON/XML gzipem (pliki statyczne Nitro ma już skompresowane wcześniej),
 *  - dodaje nagłówki bezpieczeństwa.
 * Za reverse proxy (Caddy, nginx, ingress w Kubernetesie) to też działa —
 * proxy po prostu przekaże już skompresowaną odpowiedź.
 */
const COMPRESSIBLE =
  /^(text\/|application\/(json|xml|javascript|manifest\+json|ld\+json)|image\/svg\+xml)/

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(self)',
}

function finalize(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value)
  }

  const type = headers.get('content-type') ?? ''
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
    const response = await handler.fetch(request, ...rest)
    return finalize(request, response)
  },
})
