import type { MiddlewareHandler } from 'hono'
import { ApiError } from './errors'

/** Największe ciało żądania: notatka ma do 40 tys. znaków, więc 1 MB to duży zapas. */
export const MAX_BODY_BYTES = 1024 * 1024

const tooLarge = () => new ApiError('validation.too_large', 413)

/**
 * Szybka odmowa po nagłówku Content-Length, zanim serwer zacznie czytać ciało.
 * Bez bodyLimit z Hono: ten odtwarza obiekt Request, czego Request serwera Nitro nie obsługuje.
 * Ciało bez Content-Length (chunked) ogranicza readBody przy czytaniu.
 */
export const limitBody: MiddlewareHandler = async (context, next) => {
  const length = Number(context.req.header('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) throw tooLarge()
  await next()
}

/** Czyta ciało jako tekst, przerywając po przekroczeniu limitu (bez wczytywania reszty). */
export async function readBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<string> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Array<Uint8Array> = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}
