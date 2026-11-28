import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/controls'
import { site } from '#/config/site'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { useConsent } from './consent-context'

/**
 * Baner zgody na cookies. Nie blokuje strony (to nie okno modalne), oba wybory mają ten sam
 * wygląd i wagę, a statystyki są domyślnie wyłączone. Pojawia się, dopóki nie wybierzesz,
 * i ponownie po kliknięciu „Ustawienia cookies” w stopce.
 */
export function CookieBanner() {
  const messages = useMessages(commonMessages).legal
  const { consent, settingsOpen, save, closeSettings } = useConsent()
  const [customize, setCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(consent === 'analytics')
  const ref = useRef<HTMLElement>(null)
  const visible = consent === null || settingsOpen

  // Otwarty z „Ustawień cookies”: pokazujemy od razu przełączniki i przenosimy tam fokus.
  useEffect(() => {
    if (settingsOpen) {
      setCustomize(true)
      setAnalytics(consent === 'analytics')
      ref.current?.focus()
    }
  }, [settingsOpen, consent])

  if (!visible) return null

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="cookie-title"
      aria-describedby="cookie-text"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && consent !== null) closeSettings()
      }}
      className="fixed inset-x-3 bottom-3 z-[70] max-w-md rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_24px_60px_-20px_rgba(20,22,43,0.45)] outline-none sm:inset-x-auto sm:left-4 sm:bottom-4"
    >
      <h2 id="cookie-title" className="type-heading text-xl">
        {messages.banner.title}
      </h2>
      <p
        id="cookie-text"
        className="mt-2 text-sm leading-relaxed text-ink-soft"
      >
        {fmt(messages.banner.text, { name: site.name })}{' '}
        <Link
          to="/cookies"
          className="font-medium text-ink underline underline-offset-4"
        >
          {messages.banner.policy}
        </Link>
      </p>

      {customize && (
        <div className="mt-4 space-y-3 rounded-xl border border-line p-3">
          <Switch
            label={messages.banner.necessaryTitle}
            description={messages.banner.necessaryText}
            checked
            disabled
            onCheckedChange={() => undefined}
          />
          <Switch
            label={messages.banner.analyticsTitle}
            description={messages.banner.analyticsText}
            checked={analytics}
            onCheckedChange={setAnalytics}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {customize ? (
          <Button onClick={() => save(analytics ? 'analytics' : 'necessary')}>
            {messages.banner.save}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => save('necessary')}
            >
              {messages.banner.reject}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => save('analytics')}
            >
              {messages.banner.accept}
            </Button>
            <Button variant="ghost" onClick={() => setCustomize(true)}>
              {messages.banner.customize}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

export interface CookieSettingsButtonProps {
  className?: string
}

/** Przycisk w stopce: ponownie otwiera baner z bieżącym wyborem. */
export function CookieSettingsButton({ className }: CookieSettingsButtonProps) {
  const messages = useMessages(commonMessages).legal
  const { openSettings } = useConsent()
  return (
    <button type="button" onClick={openSettings} className={className}>
      {messages.cookieSettings}
    </button>
  )
}
