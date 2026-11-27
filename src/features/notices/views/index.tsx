import { CreditCard, MailWarning } from 'lucide-react'
import type { ReactNode } from 'react'
import type { User } from '#/features/auth/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'
import { useAccountNoticesViewModel } from '../controllers/use-account-notices'

export interface AccountNoticesProps {
  user: User
}

/** Paski nad treścią panelu: nieudana płatność i niepotwierdzony adres e-mail. */
export function AccountNotices({ user }: AccountNoticesProps) {
  const t = useMessages(panelMessages).notices
  const vm = useAccountNoticesViewModel(user)
  if (vm.notices.length === 0) return null
  return (
    <section aria-label={t.label}>
      {vm.notices.map((notice) =>
        notice === 'pastDue' ? (
          <Notice
            key={notice}
            tone="danger"
            icon={<CreditCard aria-hidden className="size-4 shrink-0" />}
            text={t.pastDue}
            action={vm.opening ? t.opening : t.updatePayment}
            busy={vm.opening}
            onAction={vm.updatePayment}
          />
        ) : (
          <Notice
            key={notice}
            tone="warn"
            icon={<MailWarning aria-hidden className="size-4 shrink-0" />}
            text={fmt(t.unverified, { email: vm.email })}
            action={t.resend}
            busy={vm.resending || vm.resent}
            onAction={vm.resend}
          />
        ),
      )}
    </section>
  )
}

interface NoticeProps {
  tone: 'danger' | 'warn'
  icon: ReactNode
  text: string
  action: string
  busy: boolean
  onAction: () => void
}

function Notice({ tone, icon, text, action, busy, onAction }: NoticeProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-b px-4 py-2.5 text-center text-sm',
        tone === 'danger'
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-line bg-muted',
      )}
    >
      <p className="flex items-center gap-2">
        {icon}
        {text}
      </p>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={onAction}
        className="rounded-md border border-line bg-surface px-3 py-1 font-semibold hover:bg-muted disabled:opacity-60"
      >
        {action}
      </button>
    </div>
  )
}
