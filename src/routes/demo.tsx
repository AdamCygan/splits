import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Logo } from '#/components/brand/logo'
import { Button } from '#/components/ui/button'
import { useI18n, useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'
import type { ApiFailure } from '#/lib/api-client'
import { seo } from '#/lib/seo'
import { useErrorText } from '#/lib/use-error-text'

/**
 * /demo: jedno kliknięcie od strony głównej do działającej aplikacji z przykładowymi danymi.
 * Adres nadaje się do linkowania (Show HN, Product Hunt, opisy filmów).
 */
export const Route = createFileRoute('/demo')({
  ssr: false,
  head: () =>
    seo({
      title: panelMessages[getLocale()].demo.seoTitle,
      path: '/demo',
      noindex: true,
    }),
  component: DemoPage,
})

function DemoPage() {
  const t = useMessages(panelMessages).demo
  const { locale } = useI18n()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<ApiFailure | null>(null)

  useEffect(() => {
    let active = true
    void import('#/features/auth/demo')
      .then(({ startDemo }) => startDemo(locale))
      .then((error) => {
        if (!active) return
        if (error) setFailure(error)
        else void navigate({ to: '/app', replace: true })
      })
    return () => {
      active = false
    }
    // Język z chwili wejścia: zmiana języka w trakcie nie zakłada drugiego konta.
  }, [attempt, navigate])

  return (
    <main
      id="main"
      className="grid min-h-dvh place-items-center bg-[var(--ink-fixed)] px-6 text-white"
    >
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto text-white" />
        {failure ? (
          <div role="alert" className="mt-10">
            <h1 className="type-heading text-3xl">{t.failedTitle}</h1>
            <p className="mt-3 text-white/75">{errorText(failure)}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                className="bg-white text-[var(--ink-fixed)] hover:bg-white/90"
                onClick={() => {
                  setFailure(null)
                  setAttempt((n) => n + 1)
                }}
              >
                {t.retry}
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/register">{t.register}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div role="status" className="mt-10">
            <div
              aria-hidden
              className="demo-loader mx-auto flex h-3 w-56 gap-1 overflow-hidden rounded-full"
            >
              <span className="w-[38%] bg-wt-task" />
              <span className="w-[17%] bg-wt-review" />
              <span className="w-[14%] bg-wt-pair" />
              <span className="w-[11%] bg-wt-meeting" />
              <span className="w-[20%] bg-wt-extra" />
            </div>
            <h1 className="type-heading mt-8 text-3xl">{t.starting}</h1>
            <p className="mt-3 text-white/75">{t.startingHint}</p>
          </div>
        )}
      </div>
    </main>
  )
}
