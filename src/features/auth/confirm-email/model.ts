import { data } from '#/data'
import type { ApiFailure } from '#/lib/api-client'
import { refreshSession } from '../session'

export type ConfirmState =
  | { status: 'missing' }
  | { status: 'checking' }
  | { status: 'verified' | 'changed'; signedIn: boolean }
  | { status: 'failed'; error: ApiFailure; signedIn: boolean }

/** Token z linku w e-mailu (jak przy resecie hasła). */
export const isEmailToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[\w-]{10,200}$/.test(token)

const attempts = new Map<string, Promise<ConfirmState>>()

async function confirm(token: string): Promise<ConfirmState> {
  const result = await data.auth.confirmEmail(token)
  // Zalogowany użytkownik od razu widzi nowy adres i znika prośba o potwierdzenie.
  const signedIn = await refreshSession()
  return result.ok
    ? { status: result.value.kind, signedIn }
    : { status: 'failed', error: result.error, signedIn }
}

/**
 * Link jest jednorazowy: jedno wywołanie na token, także gdy strona zamontuje się
 * dwa razy (StrictMode, powrót wstecz). Wynik zostaje w pamięci karty.
 */
export function confirmEmailOnce(token: string): Promise<ConfirmState> {
  const pending = attempts.get(token) ?? confirm(token)
  attempts.set(token, pending)
  return pending
}
