import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { CookieSettingsButton } from '#/features/legal/cookie-banner'
import { Logo } from '#/components/brand/logo'
import { LanguageSwitcher } from '#/components/layout/language-switcher'
import { Button } from '#/components/ui/button'
import { site } from '#/config/site'
import { useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { homeMessages } from '#/i18n/messages/home'

/** Layout części publicznej (landing, cennik): renderowany na serwerze pod SEO. */
export const Route = createFileRoute('/_marketing')({
  component: MarketingLayout,
})

const sections = ['features', 'video', 'pricing', 'faq'] as const

function MarketingLayout() {
  const t = useMessages(commonMessages)
  const home = useMessages(homeMessages)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/95 backdrop-blur-sm">
        <nav
          aria-label={t.nav.home}
          className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 min-[360px]:px-4 sm:gap-6 sm:px-6"
        >
          <Link to="/" aria-label={t.nav.home} className="rounded-md">
            <Logo />
          </Link>
          <div className="hidden flex-1 items-center gap-1 md:flex">
            {sections.map((hash) => (
              <Link
                key={hash}
                to="/"
                hash={hash}
                className="rounded-md px-3 py-1.5 text-[0.9375rem] text-ink-soft transition-colors hover:text-ink"
              >
                {t.nav[hash]}
              </Link>
            ))}
            <Link
              to="/demo"
              preload={false}
              className="rounded-md px-3 py-1.5 text-[0.9375rem] font-medium text-ink hover:underline hover:underline-offset-4"
            >
              {home.nav.demo}
            </Link>
          </div>
          {/* Przy 320 px (WCAG 1.4.10) przyciski mieszczą się obok logo bez przewijania w bok. */}
          <div className="ml-auto flex items-center gap-1 min-[360px]:gap-1.5 md:ml-0">
            <Button variant="ghost" className="max-[359px]:px-2.5" asChild>
              <Link to="/login">{t.nav.login}</Link>
            </Button>
            <Button className="max-[359px]:px-3" asChild>
              <Link to="/register">{t.nav.signup}</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-ink-soft">
              © {new Date().getFullYear()} {site.name}. {t.footer.tagline}
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft"
              aria-label={t.nav.footer}
            >
              <Link to="/pricing" className="rounded-sm hover:text-ink">
                {t.nav.pricing}
              </Link>
              <Link to="/" hash="faq" className="rounded-sm hover:text-ink">
                {t.nav.faq}
              </Link>
              <Link to="/login" className="rounded-sm hover:text-ink">
                {t.nav.login}
              </Link>
              <a
                href={`mailto:${site.supportEmail}`}
                className="rounded-sm hover:text-ink"
              >
                {t.nav.contact}
              </a>
            </nav>
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft"
              aria-label={t.legal.label}
            >
              <Link to="/terms" className="rounded-sm hover:text-ink">
                {t.legal.terms}
              </Link>
              <Link to="/privacy" className="rounded-sm hover:text-ink">
                {t.legal.privacy}
              </Link>
              <Link to="/cookies" className="rounded-sm hover:text-ink">
                {t.legal.cookies}
              </Link>
              <Link to="/accessibility" className="rounded-sm hover:text-ink">
                {t.legal.accessibility}
              </Link>
              <CookieSettingsButton className="rounded-sm hover:text-ink" />
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>
    </div>
  )
}
