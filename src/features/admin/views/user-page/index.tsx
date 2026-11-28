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
import { useUserPageViewModel } from '../../controllers/use-user-page'

export interface AdminUserPageProps {
  id: string
}

/**
 * Strona jednego konta w panelu admina (MVVM; link można komuś wysłać): konto,
 * bezpieczeństwo, płatności, historia zmian i usunięcie.
 */
export function AdminUserPage({ id }: AdminUserPageProps) {
  const messages = useMessages(adminMessages)
  const viewModel = useUserPageViewModel(id)
  const user = viewModel.user
  const back = (
    <Link
      to="/app/admin"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {messages.user.back}
    </Link>
  )
  if (viewModel.pending)
    return (
      <>
        {back}
        <div
          aria-hidden
          className="mt-4 h-64 animate-pulse rounded-2xl bg-muted"
        />
      </>
    )
  if (!user)
    return (
      <>
        {back}
        <p className="mt-6 text-ink-soft">{messages.user.notFound}</p>
      </>
    )
  return (
    <>
      {back}
      <header className="mt-3 mb-6">
        <h1 className="type-display text-3xl break-words sm:text-4xl">
          {user.displayName}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-soft">
          <span className="break-all">{user.email}</span>
          <span aria-hidden>·</span>
          <span>@{user.username}</span>
          <Badge tone={planTone[user.plan]}>{messages.plans[user.plan]}</Badge>
          {user.isOwner ? (
            <Badge tone="success">{messages.badges.owner}</Badge>
          ) : (
            user.role === 'admin' && (
              <Badge tone="info">{messages.badges.admin}</Badge>
            )
          )}
          {user.isDemo && <Badge tone="muted">{messages.badges.demo}</Badge>}
          {user.disabledAt && (
            <Badge tone="warning">{messages.badges.blocked}</Badge>
          )}
          {viewModel.self && <Badge tone="muted">{messages.badges.you}</Badge>}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AccountSection viewModel={viewModel} />
          <BillingSection viewModel={viewModel} />
        </div>
        <div className="space-y-6">
          <SecuritySection viewModel={viewModel} />
          {!viewModel.locked && (
            <Panel title={messages.user.danger.title}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[46ch] text-sm text-ink-soft">
                  {messages.user.danger.text}
                </p>
                <Button
                  variant="destructive"
                  disabled={viewModel.busy}
                  onClick={() => viewModel.openDialog('delete')}
                >
                  {messages.user.danger.button}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </div>
      <div className="mt-6">
        <HistorySection viewModel={viewModel} />
      </div>
      <UserDialogs viewModel={viewModel} />
    </>
  )
}
