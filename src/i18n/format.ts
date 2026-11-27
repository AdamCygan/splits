import { localeTags } from './config'
import type { Locale } from './config'

/** Formy liczby mnogiej. Polski potrzebuje few/many ("2 wpisy", "5 wpisów"). */
export interface Plural {
  one: string
  few?: string
  many?: string
  other: string
}

/** Podstawia {nazwa} w tekście: fmt('Hi {name}', { name: 'Adam' }). */
export function fmt(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

export function plural(
  locale: Locale,
  forms: Plural,
  count: number,
  vars: Record<string, string | number> = {},
) {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(localeTags[locale])
    pluralRules.set(locale, rules)
  }
  const category = rules.select(count)
  const template =
    (category === 'one' && forms.one) ||
    (category === 'few' && forms.few) ||
    (category === 'many' && forms.many) ||
    forms.other
  return fmt(template, { n: formatNumber(locale, count), ...vars })
}

export function formatNumber(
  locale: Locale,
  value: number,
  maxFractionDigits = 1,
) {
  return value.toLocaleString(localeTags[locale], {
    maximumFractionDigits: maxFractionDigits,
  })
}

/** Czas trwania: EN "2h 10m", PL "2 h 10 min". */
export function formatMinutes(locale: Locale, total: number): string {
  const rounded = Math.round(total)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (locale === 'pl') {
    if (h === 0) return `${m} min`
    return m === 0 ? `${h} h` : `${h} h ${m} min`
  }
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatSp(locale: Locale, points: number) {
  return `${formatNumber(locale, points)} SP`
}

export function formatDate(
  locale: Locale,
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },
) {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date
  return value.toLocaleDateString(localeTags[locale], options)
}

export function formatDateRange(locale: Locale, from: string, to: string) {
  const formatter = new Intl.DateTimeFormat(localeTags[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  // Node i przeglądarka mają różne wersje ICU: jedna wstawia wąskie spacje (U+2009/U+202F)
  // wokół „–”, druga zwykłe. Normalizujemy, żeby HTML z SSR zgadzał się z hydracją.
  return formatter
    .formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`))
    .replace(/[\u2009\u202f\u00a0]/g, ' ')
}

/** Nazwy dni tygodnia w kolejności .NET DayOfWeek (0 = niedziela). */
export function weekdayNames(locale: Locale, style: 'long' | 'short' = 'long') {
  const formatter = new Intl.DateTimeFormat(localeTags[locale], {
    weekday: style,
    timeZone: 'UTC',
  })
  // 2023-01-01 to niedziela
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2023, 0, 1 + i))),
  )
}
