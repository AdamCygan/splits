import type { z } from '#/lib/zod'
import { apiRequest } from '#/lib/api-client'
import type { ApiFailure } from '#/lib/api-client'
import type { Result } from '#/lib/result'

/** Wynik wywołania API: wartość albo opis błędu (bez wyjątków). */
export type R<T> = Promise<Result<ApiFailure, T>>

/** API aplikacji (src/server, Hono pod /api/v1), ten sam adres co frontend. */
export const base = '/api/v1'

export const get = <T>(path: string, schema: z.ZodType<T>) =>
  apiRequest(`${base}${path}`, { schema })

export const send = <T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
) => apiRequest(`${base}${path}`, { method, schema, body })

/** Parametry zapytania bez pustych wartości („?a=1&b=x” albo pusty tekst). */
export const queryString = (
  params: Record<string, string | number | undefined>,
) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value))
  const text = query.toString()
  return text ? `?${text}` : ''
}

/** Archiwizacja i przywracanie zasobu (typy pracy, statusy, projekty). */
export const archive = <T>(
  resource: string,
  id: string,
  archived: boolean,
  schema: z.ZodType<T>,
  apply?: ApplyTo,
) =>
  send(
    'POST',
    withApply(`/${resource}/${id}/${archived ? 'archive' : 'restore'}`, apply),
    schema,
  )

/** Gdzie trafia zmiana: tylko bieżąca przestrzeń albo wszystkie przestrzenie konta. */
export type ApplyTo = 'this' | 'all'

/** Adres z ?apply=all, gdy zmiana ma trafić do wszystkich przestrzeni. */
export const withApply = (path: string, apply: ApplyTo = 'this') =>
  apply === 'all' ? `${path}${path.includes('?') ? '&' : '?'}apply=all` : path
