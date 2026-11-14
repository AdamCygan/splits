import { env } from '#/lib/env'

/**
 * Stałe dane produktu. Teksty zależne od języka (tytuł, opis) są w i18n/messages/common.ts.
 * "Pointhours" = story pointy i godziny: ile czasu naprawdę kosztuje każdy punkt sprintu.
 * Przed startem sprawdź dostępność domeny i znaku towarowego (EUIPO, UPRP).
 * Adres produkcyjny ustawiasz przez VITE_APP_URL — od niego zależą canonical, sitemap i Open Graph.
 */
export const site = {
  name: 'Pointhours',
  url: env.VITE_APP_URL,
  ogImage: '/og.png',
  ogImagePl: '/og-pl.png',
  themeColor: '#14162b',
  supportEmail: 'support@example.com',
} as const

export const absoluteUrl = (path: string) =>
  new URL(path, `${site.url}/`).toString()
