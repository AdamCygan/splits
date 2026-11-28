/**
 * Zgoda na cookies. „necessary” = tylko niezbędne, „analytics” = także statystyki (PostHog).
 * Zmiana wersji (v1 → v2) ponownie pyta o zgodę, np. po dodaniu nowej kategorii.
 */
export const CONSENT_COOKIE = 'app_consent'
export const CONSENT_VERSION = 'v1'
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365 // 12 miesięcy

export type Consent = 'necessary' | 'analytics'

/** Wartość ciasteczka („v1:analytics”) → zgoda; inna wersja albo śmieci = brak zgody. */
export const parseConsent = (raw: string | undefined): Consent | null => {
  const [version, value] = (raw ?? '').split(':')
  const isOutdated = version !== CONSENT_VERSION
  if (isOutdated) return null
  return value === 'analytics' || value === 'necessary' ? value : null
}
