import { pad2 as pad } from '#/shared/domain/text'
import { createLocalStore } from './local-store'

/**
 * Format godziny: automatycznie z języka (EN 12h, PL 24h), albo na stałe 24h lub 12h.
 * Preferencja tej przeglądarki (localStorage), jak motyw: nie wymaga zmian na serwerze.
 */
export type ClockPref = 'auto' | 'h24' | 'h12'
export const clockPrefs: readonly ClockPref[] = ['auto', 'h24', 'h12']

const store = createLocalStore<ClockPref>('ph-clock', clockPrefs, 'auto')
export const readClock = store.read
export const setClock = store.set
export const useClockPref = store.use

/** Czy pokazywać 12-godzinny zegar (AM/PM) dla danego języka. */
export function uses12h(tag: string, preference: ClockPref = readClock()) {
  if (preference !== 'auto') return preference === 'h12'
  return (
    new Intl.DateTimeFormat(tag, { hour: 'numeric' }).resolvedOptions()
      .hourCycle === 'h12'
  )
}

/** Opcje Intl dla godziny zgodne z preferencją. */
export function hourOptions(tag: string): Intl.DateTimeFormatOptions {
  return uses12h(tag)
    ? { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }
    : { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }
}

/** Godzina "HH:MM" w formacie użytkownika (12h/24h wg preferencji, domyślnie z języka). */
export const clockTime = (tag: string, time: string) =>
  new Intl.DateTimeFormat(tag, {
    ...hourOptions(tag),
    timeZone: 'UTC',
  }).format(new Date(`1970-01-01T${time}:00Z`))

/** "HH:MM" (24h) do wyświetlenia w polu: "14:30" albo "2:30 PM". */
export function displayTime(value: string, twelve: boolean) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  const hours = Number(match[1])
  if (!twelve) return value
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
}

/**
 * Wpisany tekst do "HH:MM" (24h) albo null. Rozumie: 9, 930, 0930, 9:30, 9.30, 14:05,
 * 2:30pm, 2 PM, 12am. Bez AM/PM godzina jest w zapisie 24h (14:30), bez zgadywania.
 */
export function parseTime(raw: string): string | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(a|am|p|pm)?$/.exec(text)
  if (!match) return null
  let hours = Number(match[1])
  const min = match[2] === undefined ? 0 : Number(match[2])
  const suffix = match[3]
  if (min > 59) return null
  if (suffix) {
    if (hours < 1 || hours > 12) return null
    if (suffix.startsWith('a')) hours = hours === 12 ? 0 : hours
    else hours = hours === 12 ? 12 : hours + 12
  }
  if (hours > 23) return null
  return `${pad(hours)}:${pad(min)}`
}
