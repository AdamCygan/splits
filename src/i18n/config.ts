/**
 * Języki aplikacji. Angielski jest domyślny (rynek docelowy, SEO),
 * polski to drugi język do wyboru w przełączniku.
 */
export const locales = ['en', 'pl'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'
export const LOCALE_COOKIE = 'app_locale'

/** Nazwy języków zawsze w ich własnym języku — tak je rozpoznaje użytkownik. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  pl: 'Polski',
}

/** Tagi BCP 47 dla Intl (daty, liczby) i atrybutu lang. */
export const localeTags: Record<Locale, string> = {
  en: 'en-US',
  pl: 'pl-PL',
}

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (locales as ReadonlyArray<string>).includes(value)
