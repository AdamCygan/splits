import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import {
  BarChart3,
  CalendarRange,
  Clock,
  ListTodo,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { Logo } from '#/components/brand/logo'
import { AccountMenu } from '#/components/layout/account-menu'
import { useBootstrap } from '#/features/app/bootstrap'
import {
  onSessionExpired,
  signOut,
  useCurrentUser,
} from '#/features/auth/session'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { commonMessages } from '#/i18n/messages/common'
import { panelMessages } from '#/i18n/messages/panel'
import { TimerBar } from '#/features/time-entries/components/timer'
import { useClockPref } from '#/lib/clock'
import { applyTheme } from '#/lib/theme'
import { QueryProvider } from '#/integrations/tanstack-query/query-provider'

/**
 * Panel aplikacji (/app/*). Renderowany tylko w przeglądarce (ssr: false):
 * sesja żyje w pamięci przeglądarki i ciasteczku httpOnly, a panel nie potrzebuje SEO.
 */
export const Route = createFileRoute('/app')({
  ssr: false,
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  beforeLoad: async ({ location }) => {
    // Import dynamiczny: moduł sesji (z Zod) nie trafia do bundla strony głównej.
    const { ensureSession } = await import('#/features/auth/session')
    if (!(await ensureSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  pendingComponent: AppPending,
  component: AppLayout,
})

function AppPending() {
  const t = useMessages(commonMessages)
  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center text-ink-soft"
    >
      {t.loading}
    </div>
  )
}

const nav = [
  { to: '/app', key: 'today', icon: Clock, exact: true },
  { to: '/app/tasks', key: 'tasks', icon: ListTodo, exact: false },
  { to: '/app/sprints', key: 'sprints', icon: CalendarRange, exact: false },
  { to: '/app/analytics', key: 'reports', icon: BarChart3, exact: false },
  { to: '/app/settings', key: 'settings', icon: Settings, exact: false },
] as const

function AppLayout() {
  return (
    <QueryProvider>
      <AppShell />
      <Toaster
        position="bottom-right"
        closeButton
        richColors={false}
        toastOptions={{ className: 'font-sans' }}
        offset={{ bottom: 24 }}
        mobileOffset={{ bottom: 88 }}
      />
    </QueryProvider>
  )
}

/** Pasek konta demo: jasno mówi, że dane są przykładowe, i prowadzi do rejestracji. */
function DemoBanner({ onRegister }: { onRegister: () => void }) {
  const t = useMessages(panelMessages).demo
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-[var(--ink-fixed)] px-4 py-2.5 text-center text-sm text-white"
    >
      <span>{t.banner}</span>
      <button
        type="button"
        onClick={onRegister}
        className="rounded-md bg-white px-3 py-1 font-semibold text-[var(--ink-fixed)] hover:bg-white/90"
      >
        {t.bannerCta}
      </button>
    </div>
  )
}

function AppShell() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const t = useMessages(appMessages)
  const common = useMessages(commonMessages)
  const panel = useMessages(panelMessages)
  // Konto, konfiguracja i dzisiejszy dzień jednym żądaniem, zanim ekrany zaczną pytać osobno.
  const boot = useBootstrap()

  const queryClient = useQueryClient()
  // Sesja wygasła w trakcie pracy: czyścimy dane z pamięci i wracamy na logowanie,
  // a po zalogowaniu na tę samą stronę.
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear()
        const here = `${window.location.pathname}${window.location.search}`
        void navigate({
          to: '/login',
          search: {
            ...(here.startsWith('/app') ? { redirect: here } : {}),
            expired: true,
          },
          replace: true,
        })
      }),
    [navigate, queryClient],
  )

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }
  const leaveDemo = async () => {
    await signOut()
    await navigate({ to: '/register' })
  }

  // Ciemny motyw dotyczy tylko panelu: zdejmujemy go po wyjściu na stronę główną.
  useEffect(() => {
    applyTheme()
    return () => applyTheme(false)
  }, [])

  // Zmiana formatu godziny przerysowuje stronę, żeby wszystkie godziny poszły za nią.
  const clock = useClockPref()
  const section = pathname.split('/').slice(0, 3).join('/')

  if (boot.isPending) return <AppPending />

  return (
    <>
      <div className="flex min-h-dvh">
        {/* Boczne menu (komputer): przyklejone, na pełną wysokość okna */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
          <div className="mb-8 flex items-center justify-between px-2 pt-1">
            <Link to="/app" aria-label={common.nav.home} className="rounded-md">
              <Logo />
            </Link>
          </div>
          <nav aria-label={t.nav.label} className="flex flex-col gap-0.5">
            {nav.map(({ to, key, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-ink-soft transition-colors duration-150 hover:bg-muted hover:text-ink data-[status=active]:bg-[var(--ink-fixed)] data-[status=active]:text-white"
              >
                <Icon aria-hidden className="size-[1.125rem]" />
                {t.nav[key]}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link
                to="/app/admin"
                className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-[0.9375rem] font-medium text-ink-soft hover:bg-muted hover:text-ink data-[status=active]:border-transparent data-[status=active]:bg-[var(--ink-fixed)] data-[status=active]:text-white"
              >
                <ShieldCheck aria-hidden className="size-[1.125rem]" />
                {panel.admin.nav}
              </Link>
            )}
          </nav>
          {user && (
            <div className="mt-auto border-t border-line pt-3">
              <AccountMenu user={user} onSignOut={() => void handleSignOut()} />
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Górny pasek (telefon) */}
          <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
            <Link to="/app" aria-label={common.nav.home} className="rounded-md">
              <Logo />
            </Link>
            <div className="flex items-center gap-1">
              {user?.role === 'admin' && (
                <Link
                  to="/app/admin"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-soft data-[status=active]:text-ink"
                >
                  <ShieldCheck aria-hidden className="size-4" />
                  {panel.admin.nav}
                </Link>
              )}
              {user && (
                <AccountMenu
                  user={user}
                  compact
                  onSignOut={() => void handleSignOut()}
                />
              )}
            </div>
          </header>

          {user?.isDemo && <DemoBanner onRegister={() => void leaveDemo()} />}
          <TimerBar />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 md:px-10 md:pt-10 md:pb-12"
          >
            {/* Krótkie wejście przy zmianie zakładki (klucz = sekcja, nie każda podstrona ustawień). */}
            <div key={`${section}:${clock}`} className="page-in">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Dolny pasek zakładek (telefon): duże cele dotyku, ikona + podpis */}
        <nav
          aria-label={t.nav.label}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid grid-cols-5">
            {nav.map(({ to, key, icon: Icon, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className="flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft data-[status=active]:text-ink"
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <>
                      <span
                        className={
                          isActive
                            ? 'grid h-7 w-12 place-items-center rounded-full bg-[var(--ink-fixed)] text-white'
                            : 'grid h-7 w-12 place-items-center'
                        }
                      >
                        <Icon aria-hidden className="size-[1.125rem]" />
                      </span>
                      {t.nav[key]}
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}
