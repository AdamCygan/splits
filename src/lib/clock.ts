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
export function uses12h(tag: string, pref: ClockPref = readClock()) {
  if (pref !== 'auto') return pref === 'h12'
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
  const m = /^(\d{2}):(\d{2})$/.exec(value)
  if (!m) return value
  const h = Number(m[1])
  if (!twelve) return value
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Wpisany tekst do "HH:MM" (24h) albo null. Rozumie: 9, 930, 0930, 9:30, 9.30, 14:05,
 * 2:30pm, 2 PM, 12am. Bez AM/PM godzina jest w zapisie 24h (14:30), bez zgadywania.
 */
export function parseTime(raw: string): string | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(a|am|p|pm)?$/.exec(text)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] === undefined ? 0 : Number(m[2])
  const suffix = m[3]
  if (min > 59) return null
  if (suffix) {
    if (h < 1 || h > 12) return null
    if (suffix.startsWith('a')) h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
  }
  if (h > 23) return null
  return `${pad(h)}:${pad(min)}`
}
