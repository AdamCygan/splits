import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { ApiError } from '#/lib/api-client'
import { TwoFactorRequired } from './components/two-factor-required'
import { adminStatsQuery } from './queries'

/**
 * Układ panelu admina: zakładki (Użytkownicy, Dziennik zmian) i treść. Gdy serwer wymaga
 * 2FA dla adminów (ADMIN_REQUIRE_2FA), zamiast treści wyjaśnienie, co zrobić.
 */
export function AdminLayout() {
  const t = useMessages(adminMessages)
  const access = useQuery(adminStatsQuery)
  // Strona konta należy do zakładki „Użytkownicy”.
  const onLog = useLocation({
    select: (location) => location.pathname.startsWith('/app/admin/log'),
  })
  const blocked =
    access.error instanceof ApiError &&
    access.error.details.code === 'admin.two_factor_required'
  if (blocked) return <TwoFactorRequired />
  const tab =
    'rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-muted hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-surface'
  return (
    <div className="mx-auto max-w-6xl">
      <nav aria-label={t.tabs.label} className="mb-5 flex gap-1">
        <Link
          to="/app/admin"
          activeOptions={{ exact: true, includeSearch: false }}
          className={tab}
        >
          {t.tabs.users}
        </Link>
        <Link
          to="/app/admin/log"
          aria-current={onLog ? 'page' : undefined}
          className={tab}
        >
          {t.tabs.log}
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}
