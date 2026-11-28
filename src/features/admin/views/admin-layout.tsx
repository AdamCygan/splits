import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { feedbackMessages } from '#/i18n/messages/feedback'
import { fmt } from '#/i18n/format'
import { adminFeedbackOpenQuery } from '#/features/feedback/data/queries'
import { ApiError } from '#/lib/api-client'
import { TwoFactorRequired } from './two-factor-required'
import { adminStatsQuery } from '../data/queries'

/**
 * Układ panelu admina: zakładki (Użytkownicy, Zgłoszenia, Dziennik zmian) i treść. Gdy serwer wymaga
 * 2FA dla adminów (ADMIN_REQUIRE_2FA), zamiast treści wyjaśnienie, co zrobić.
 */
export function AdminLayout() {
  const t = useMessages(adminMessages)
  const feedback = useMessages(feedbackMessages)
  const access = useQuery(adminStatsQuery)
  const openReports = useQuery(adminFeedbackOpenQuery).data?.new ?? 0
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
        <Link to="/app/admin/feedback" className={tab}>
          {feedback.admin.nav}
          {openReports > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--wt-extra)] px-1.5 py-0.5 text-xs font-semibold text-white">
              <span className="sr-only">
                {fmt(feedback.admin.newBadge, { count: openReports })}
              </span>
              <span aria-hidden>{openReports}</span>
            </span>
          )}
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
