import { useCallback } from 'react'
import { useMessages } from '#/i18n/context'
import { errorMessages, isKnownError } from '#/i18n/messages/errors'
import type { ApiFailure } from './api-client'

/** Komunikat błędu w języku użytkownika: znany kod → tłumaczenie, inaczej tekst z serwera. */
export function useErrorText() {
  const t = useMessages(errorMessages)
  return useCallback(
    (failure: ApiFailure) =>
      isKnownError(failure.code) ? t[failure.code] : failure.message,
    [t],
  )
}

/** Błędy pól z API (klucze camelCase lub PascalCase) → mapa nazw pól formularza. */
export function fieldErrorsOf(
  failure: ApiFailure,
): Record<string, Array<string>> {
  const out: Record<string, Array<string>> = {}
  for (const [key, messages] of Object.entries(failure.fieldErrors)) {
    out[key.charAt(0).toLowerCase() + key.slice(1)] = messages
  }
  return out
}
