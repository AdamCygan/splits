import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Locale } from '#/i18n/config'
import { errorMessages } from '#/i18n/messages/errors'
import type { ErrorCode } from '#/i18n/messages/errors'

/**
 * Błąd domenowy: stabilny kod (taki sam jak w słowniku errors.ts), status HTTP i opcjonalne pole formularza.
 * Handler zamienia go na Problem Details (RFC 9457), które rozumie api-client po stronie przeglądarki.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode = 400,
    readonly field?: string,
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

export const notFound = () => new ApiError('not_found', 404)
export const invalid = (field?: string) =>
  new ApiError('validation.invalid', 400, field)
export const conflict = (code: ErrorCode, field?: string) =>
  new ApiError(code, 409, field)

export function problem(
  locale: Locale,
  code: ErrorCode,
  status: number,
  fields: Array<string> = [],
  traceId?: string,
) {
  const message = errorMessages[locale][code]
  return {
    type: 'about:blank',
    title: message,
    status,
    detail: message,
    code,
    errors: Object.fromEntries(fields.map((field) => [field, [message]])),
    traceId,
  }
}

/** Naruszenia ograniczeń w Postgresie (np. równoległe żądania) zamieniamy na czytelne błędy. */
export function fromDatabaseError(error: unknown): ApiError | null {
  const postgres =
    (error as { cause?: { code?: string; constraint?: string } }).cause ??
    (error as { code?: string; constraint?: string })
  const isUniqueViolation = postgres.code === '23505'
  if (isUniqueViolation) {
    const character = postgres.constraint ?? ''
    const isUsernameTaken = character.includes('username')
    if (isUsernameTaken) return conflict('auth.username_taken', 'username')
    const isEmailTaken = character.includes('email')
    if (isEmailTaken) return conflict('auth.email_taken', 'email')
    const isHotkeyTaken = character.includes('hotkey')
    if (isHotkeyTaken) return conflict('hotkey_taken', 'hotkey')
    const isProjectKeyTaken = character === 'projects_key_key'
    if (isProjectKeyTaken) return conflict('key_taken', 'key')
    const isNameTaken = character.includes('name')
    if (isNameTaken) return conflict('name_taken', 'name')
    return conflict('validation.invalid')
  }
  const isInvalidValue =
    postgres.code === '23514' ||
    postgres.code === '22P02' ||
    postgres.code === '22007'
  if (isInvalidValue) return invalid()
  const isMissingReference = postgres.code === '23503'
  if (isMissingReference) return new ApiError('validation.invalid', 400)
  return null
}
