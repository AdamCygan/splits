/**
 * Zmienne środowiskowe sprawdzane przy starcie — brak/literówka = czytelny błąd od razu.
 * Bez Zod, bo ten moduł trafia do każdej strony, a landing ma ładować jak najmniej JS.
 */
interface Env {
  /** Pusty = API pod tym samym adresem co strona (/api/v1). */
  VITE_API_URL: string
  VITE_APP_URL: string
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
}

function url(name: string, value: unknown, fallback?: string): string {
  const raw = typeof value === 'string' && value !== '' ? value : fallback
  if (raw === undefined) throw new Error(`Brak zmiennej środowiskowej ${name}.`)
  try {
    return new URL(raw).toString().replace(/\/$/, '')
  } catch {
    throw new Error(
      `Zmienna ${name} musi być pełnym adresem URL, a jest: "${raw}".`,
    )
  }
}

const optional = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined

const source = import.meta.env as Record<string, unknown>

export const environment: Env = {
  VITE_API_URL: optional(source.VITE_API_URL)
    ? url('VITE_API_URL', source.VITE_API_URL)
    : '',
  VITE_APP_URL: url(
    'VITE_APP_URL',
    source.VITE_APP_URL,
    'http://localhost:3000',
  ),
  VITE_POSTHOG_KEY: optional(source.VITE_POSTHOG_KEY),
  VITE_POSTHOG_HOST: optional(source.VITE_POSTHOG_HOST)
    ? url('VITE_POSTHOG_HOST', source.VITE_POSTHOG_HOST)
    : undefined,
}
