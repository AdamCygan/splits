import { createFileRoute } from '@tanstack/react-router'

/**
 * Całe API (/api/v1/*) obsługuje aplikacja Hono z src/server. Import dynamiczny trzyma
 * kod serwera (baza, hasła, tokeny) poza bundlem przeglądarki.
 */
const handle = async ({ request }: { request: Request }) => {
  const { api } = await import('#/server/app')
  return api.fetch(request)
}

export const Route = createFileRoute('/api/v1/$')({
  server: { handlers: { ANY: handle } },
})
