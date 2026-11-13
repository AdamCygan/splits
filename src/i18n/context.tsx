import { createContext, useCallback, useContext, useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { localeTags } from './config'
import { formatMinutes, formatNumber, formatSp, plural } from './format'
import { persistLocale } from './locale'
import type { Locale } from './config'
import type { Plural } from './format'

type I18nValue = {
  locale: Locale
  /** BCP 47, np. "en-US" — do Intl i atrybutu lang. */
  tag: string
  setLocale: (locale: Locale) => Promise<void>
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
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

/** Gotowe formatery związane z bieżącym językiem. */
export function useFormat() {
  const { locale } = useI18n()
  return useMemo(
    () => ({
      minutes: (total: number) => formatMinutes(locale, total),
      sp: (points: number) => formatSp(locale, points),
      number: (value: number, digits = 1) =>
        formatNumber(locale, value, digits),
      plural: (
        forms: Plural,
        count: number,
        vars?: Record<string, string | number>,
      ) => plural(locale, forms, count, vars),
    }),
    [locale],
  )
}

export type Dictionary<T> = Record<Locale, T>
