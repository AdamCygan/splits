import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { planTone } from '../users-page/users-table'
import { AccountSection } from './account-section'
import { BillingSection } from './billing-section'
import { UserDialogs } from './dialogs'
import { HistorySection } from './history-section'
import { SecuritySection } from './security-section'
import { useUserPageViewModel } from './use-user-page'

export interface AdminUserPageProps {
  id: string
}

/**
 * Strona jednego konta w panelu admina (MVVM; link można komuś wysłać): konto,
 * bezpieczeństwo, płatności, historia zmian i usunięcie.
 */
export function AdminUserPage({ id }: AdminUserPageProps) {
  const t = useMessages(adminMessages)
  const vm = useUserPageViewModel(id)
  const u = vm.user
  const back = (
    <Link
      to="/app/admin"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {t.user.back}
    </Link>
  )
  if (vm.pending)
    return (
      <>
        {back}
        <div
          aria-hidden
          className="mt-4 h-64 animate-pulse rounded-2xl bg-muted"
        />
      </>
    )
  if (!u)
    return (
      <>
        {back}
        <p className="mt-6 text-ink-soft">{t.user.notFound}</p>
      </>
    )
  return (
    <>
      {back}
      <header className="mt-3 mb-6">
        <h1 className="type-display text-3xl break-words sm:text-4xl">
          {u.displayName}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-soft">
          <span className="break-all">{u.email}</span>
          <span aria-hidden>·</span>
          <span>@{u.username}</span>
          <Badge tone={planTone[u.plan]}>{t.plans[u.plan]}</Badge>
          {u.isOwner ? (
            <Badge tone="success">{t.badges.owner}</Badge>
          ) : (
            u.role === 'admin' && <Badge tone="info">{t.badges.admin}</Badge>
          )}
          {u.isDemo && <Badge tone="muted">{t.badges.demo}</Badge>}
          {u.disabledAt && <Badge tone="warning">{t.badges.blocked}</Badge>}
          {vm.self && <Badge tone="muted">{t.badges.you}</Badge>}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AccountSection vm={vm} />
          <BillingSection vm={vm} />
        </div>
        <div className="space-y-6">
          <SecuritySection vm={vm} />
          {!vm.locked && (
            <Panel title={t.user.danger.title}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[46ch] text-sm text-ink-soft">
                  {t.user.danger.text}
                </p>
                <Button
                  variant="destructive"
                  disabled={vm.busy}
                  onClick={() => vm.openDialog('delete')}
                >
                  {t.user.danger.button}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </div>
      <div className="mt-6">
        <HistorySection vm={vm} />
      </div>
      <UserDialogs vm={vm} />
    </>
  )
}
