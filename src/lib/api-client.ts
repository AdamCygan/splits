import { z } from '#/lib/zod'
import { environment } from './env'
import { getAccessToken } from './auth-token'
import { failure, success } from './result'
import type { Result } from './result'

/**
 * Ujednolicony błąd z API. Backend zawsze zwraca Problem Details (RFC 9457)
 * z polem "code"; błędy sieci i nieoczekiwane odpowiedzi mapujemy na ten sam kształt.
 */
export interface ApiFailure {
  /** Kod HTTP; 0 = brak połączenia z serwerem. */
  status: number
  /** Stabilny kod błędu z backendu, np. "task.not_found", "http.404". */
  code: string
  /** Komunikat do pokazania użytkownikowi. */
  message: string
  /** Błędy pól formularza (tylko przy walidacji). */
  fieldErrors: Record<string, Array<string>>
  traceId?: string
}

const problemDetailsSchema = z.object({
  status: z.number().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  code: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  traceId: z.string().optional(),
})

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions<T> {
  method?: HttpMethod
  body?: unknown
  /** Schemat odpowiedzi — dane z API są walidowane, a nie "rzutowane na ślepo". */
  schema: z.ZodType<T>
  signal?: AbortSignal
  /** false = nie próbuj odświeżać sesji po 401 (np. same endpointy /auth). */
  retryOnUnauthorized?: boolean
}

/** Rejestrowane przez moduł auth: odświeża sesję, zwraca true gdy się udało. */
let unauthorizedHandler: (() => Promise<boolean>) | null = null
export function setUnauthorizedHandler(handler: () => Promise<boolean>) {
  unauthorizedHandler = handler
}

export const emptyResponse = z.undefined()

export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<Result<ApiFailure, T>> {
  const {
    method = 'GET',
    body,
    schema,
    signal,
    retryOnUnauthorized = true,
  } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${environment.VITE_API_URL}${path}`, {
      method,
      signal,
      credentials: 'include', // refresh token w ciasteczku httpOnly
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    return failure({
      status: 0,
      code: 'network.unreachable',
      message:
        'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
      fieldErrors: {},
    })
  }

  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)

  if (response.status === 401 && retryOnUnauthorized && unauthorizedHandler) {
    if (await unauthorizedHandler()) {
      return apiRequest(path, { ...options, retryOnUnauthorized: false })
    }
  }

  if (!response.ok) {
    const problem = problemDetailsSchema.safeParse(payload)
    const data = problem.success ? problem.data : {}
    return failure({
      status: response.status,
      code: data.code ?? `http.${response.status}`,
      message: data.detail ?? data.title ?? 'Coś poszło nie tak.',
      fieldErrors: data.errors ?? {},
      traceId: data.traceId,
    })
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return failure({
      status: response.status,
      code: 'response.invalid',
      message: 'Serwer zwrócił nieoczekiwaną odpowiedź.',
      fieldErrors: {},
    })
  }

  return success(parsed.data)
}

/** Błąd rzucany tylko na potrzeby TanStack Query (queryFn musi rzucać). */
export class ApiError extends Error {
  constructor(readonly details: ApiFailure) {
    super(details.message)
    this.name = 'ApiError'
  }
}

/** Zamienia Result na wartość albo wyjątek — do użycia w queryFn. */
export async function unwrap<T>(
  promise: Promise<Result<ApiFailure, T>>,
): Promise<T> {
  const result = await promise
  if (!result.ok) throw new ApiError(result.error)
  return result.value
}
