import { Suspense, lazy } from 'react'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { RouteAnnouncer } from '#/components/layout/route-announcer'
import { site } from '#/config/site'
import { I18nProvider, useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { commonMessages } from '#/i18n/messages/common'
import { CookieBanner } from '#/features/legal/views/cookie-banner'
import { getConsent } from '#/features/legal/data/consent'
import { ConsentProvider } from '#/features/legal/views/consent-context'
import displayFont from '#/assets/fonts/brand-display-core.woff2?url'
import textFont from '#/assets/fonts/brand-text-core.woff2?url'

import appCss from '../styles.css?url'
import { themeBootScript } from '#/lib/theme'

/** W produkcji ten import znika z bundla (import.meta.env.DEV === false). */
const Devtools = import.meta.env.DEV
  ? lazy(() => import('#/integrations/devtools'))
  : () => null

export const Route = createRootRoute({
  // Język z ciasteczka; wynik trafia do HTML, więc przeglądarka hydratuje ten sam język.
  // Zgoda na cookies też z ciasteczka: baner renderuje się już w HTML (bez skoku po hydracji).
  loader: () => ({ locale: getLocale(), consent: getConsent() }),
  head: () => {
    const common = commonMessages[getLocale()]
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: site.themeColor },
        { name: 'color-scheme', content: 'light' },
        { title: common.seo.title },
        { name: 'description', content: common.seo.description },
      ],
      links: [
        // Fonty preloadowane razem z HTML: tekst od razu w docelowym kroju, bez skoku układu.
        {
          rel: 'preload',
          href: textFont,
          as: 'font',
          type: 'font/woff2',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'preload',
          href: displayFont,
          as: 'font',
          type: 'font/woff2',
          crossOrigin: 'anonymous',
        },
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    }
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  const t = useMessages(commonMessages).notFound
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center outline-none"
    >
      <p className="text-sm text-ink-soft">{t.code}</p>
      <h1 className="type-heading text-4xl">{t.title}</h1>
      <Link to="/" className="font-medium underline underline-offset-4">
        {t.back}
      </Link>
    </main>
  )
}

function SkipLink() {
  const t = useMessages(commonMessages)
  return (
    <a
      href="#main"
      className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-[var(--ink-fixed)] px-4 py-2.5 font-medium text-white shadow-lg transition-transform focus:translate-y-0"
    >
      {t.skipLink}
    </a>
  )
}

interface RootDocumentProps {
  children: ReactNode
}

function RootDocument({ children }: RootDocumentProps) {
  const { locale, consent } = Route.useLoaderData()
  const nonce = useRouter().options.ssr?.nonce

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          nonce={nonce}
          suppressHydrationWarning
          // Stały skrypt motywu z #/lib/theme, bez danych od użytkownika.
          // eslint-disable-next-line no-restricted-syntax
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <ConsentProvider initial={consent}>
            <SkipLink />
            {children}
            <RouteAnnouncer />
            <CookieBanner />
          </ConsentProvider>
        </I18nProvider>
        <Suspense>
          <Devtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
