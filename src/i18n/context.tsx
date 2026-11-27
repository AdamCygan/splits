import { createContext, useCallback, useContext, useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { fromMinutes } from '#/domain/entries'
import { clockTime, useClockPref } from '#/lib/clock'
import { localeTags } from './config'
import {
  fmt,
  formatDate,
  formatMinutes,
  formatMoney,
  formatNumber,
  formatSp,
  plural,
} from './format'
import { persistLocale } from './locale'
import type { Locale } from './config'
import type { Plural } from './format'

interface I18nValue {
  locale: Locale
  /** BCP 47, np. "en-US" — do Intl i atrybutu lang. */
  tag: string
  setLocale: (locale: Locale) => Promise<void>
}

const I18nContext = createContext<I18nValue | null>(null)

export interface I18nProviderProps {
  locale: Locale
  children: ReactNode
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const router = useRouter()
  const setLocale = useCallback(
    async (next: Locale) => {
      persistLocale(next)
      document.documentElement.lang = next
      // Ponowne uruchomienie loaderów: root odczyta nowy język z ciasteczka.
      await router.invalidate()
    },
    [router],
  )
  const value = useMemo(
    () => ({ locale, tag: localeTags[locale], setLocale }),
    [locale, setLocale],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>.')
  return ctx
}

/**
 * Słownik danego obszaru w bieżącym języku. Każdy obszar ma osobny moduł { en, pl },
 * więc tłumaczenia ładują się razem z kodem strony, która ich używa.
 */
export function useMessages<T>(dictionary: Record<Locale, T>): T {
  return dictionary[useI18n().locale]
}

/** Teksty różnicy wobec planu; `{time}` zastępuje czas. */
export interface DeltaMessages {
  over: string
  under: string
  exact: string
}

export interface DayFormatOptions {
  year?: boolean
}

/** Gotowe formatery związane z bieżącym językiem. */
export function useFormat() {
  const { locale, tag } = useI18n()
  // Zmiana 12h/24h w ustawieniach od razu przelicza godziny na stronie.
  const clock = useClockPref()
  return useMemo(() => {
    const time = (value: string | number) =>
      clockTime(tag, typeof value === 'number' ? fromMinutes(value) : value)
    return {
      /** Godzina w formacie użytkownika: "HH:MM" albo minuty od północy. */
      time,
      /** Przedział godzin: „9:00–10:30”. */
      timeRange: (start: string | number, end: string | number) =>
        `${time(start)}–${time(end)}`,
      /** Godziny sesji z czasem („9:00–10:30, 1 h 30 min”) albo sam czas, gdy bez godzin. */
      session: (start: string | null, end: string | null, minutes: number) =>
        start && end
          ? `${time(start)}–${time(end)}, ${formatMinutes(locale, minutes)}`
          : formatMinutes(locale, minutes),
      /** Różnica czasu wobec planu: „+30 min ponad”, „15 min mniej”, „dokładnie”. */
      delta: (diff: number, forms: DeltaMessages) =>
        diff > 0
          ? fmt(forms.over, { time: formatMinutes(locale, diff) })
          : diff < 0
            ? fmt(forms.under, { time: formatMinutes(locale, -diff) })
            : forms.exact,
      /** Kwota w najmniejszej jednostce waluty (np. centy ze Stripe). */
      money: (minorUnits: number, currency: string) =>
        formatMoney(tag, minorUnits, currency),
      minutes: (total: number) => formatMinutes(locale, total),
      sp: (points: number) => formatSp(locale, points),
      number: (value: number, digits = 1) =>
        formatNumber(locale, value, digits),
      /** Krótki dzień: „czw., 26 lis” (z rokiem: „czw., 26 lis 2026”). */
      day: (date: string, options: DayFormatOptions = {}) =>
        formatDate(locale, date, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          ...(options.year ? { year: 'numeric' } : {}),
        }),
      plural: (
        forms: Plural,
        count: number,
        vars?: Record<string, string | number>,
      ) => plural(locale, forms, count, vars),
    }
    // `clock` w zależnościach: ta sama funkcja daje inny wynik po zmianie 12h/24h.
  }, [locale, tag, clock])
}

export type Dictionary<T> = Record<Locale, T>
