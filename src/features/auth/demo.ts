import { data } from '#/data'
import type { Locale } from '#/i18n/config'
import { track } from '#/integrations/posthog/analytics'
import type { ApiFailure } from '#/lib/api-client'
import { ensureSession, getCurrentUser, startSession } from './session'

let starting: Promise<ApiFailure | null> | null = null

/** Zakłada konto demo, chyba że ktoś już jest zalogowany. Zwraca błąd albo null. */
async function openDemo(locale: Locale): Promise<ApiFailure | null> {
  if (getCurrentUser() ?? (await ensureSession())) return null
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const result = await data.auth.demo({ locale, timezone })
  if (!result.ok) return result.error
  startSession(result.value)
  track('demo_started', { locale })
  return null
}

/**
 * Otwiera demo: nowe konto z przykładowymi danymi (bez rejestracji).
 * Kto jest już zalogowany (także w trwającym demo), zostaje na swoim koncie.
 * Jedno wywołanie naraz, nawet gdy komponent zamontuje się dwa razy.
 */
export function startDemo(locale: Locale): Promise<ApiFailure | null> {
  starting ??= openDemo(locale).finally(() => {
    starting = null
  })
  return starting
}
