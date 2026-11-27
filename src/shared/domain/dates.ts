/** Operacje na datach dziennych 'YYYY-MM-DD' w UTC — bez przesunięć stref czasowych. */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d))
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(value: string, days: number): string {
  const d = parseDate(value)
  d.setUTCDate(d.getUTCDate() + days)
  return toIsoDate(d)
}

export function diffDays(from: string, to: string): number {
  return Math.round(
    (parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000,
  )
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  return toIsoDate(parseDate(value)) === value
}

/** Dzisiejsza data w podanej strefie (domyślnie strefa przeglądarki). */
export function todayIn(timeZone?: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
  return parts
}

/** Bieżąca godzina 'HH:MM' w strefie użytkownika. */
export function nowTimeIn(timeZone?: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at)
}

/** Dzień tygodnia 0–6 (0 = niedziela) dla daty 'YYYY-MM-DD'. */
export function weekday(value: string): number {
  return parseDate(value).getUTCDay()
}

/** Najbliższy dzień tygodnia `day` w dniu `value` lub wcześniej. */
export function startOfWeek(value: string, weekStartsOn: number): string {
  const diff = (weekday(value) - weekStartsOn + 7) % 7
  return addDays(value, -diff)
}
