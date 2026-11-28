import { Check, LogOut } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import type { SectionProps } from './account-section'

/**
 * Bezpieczeństwo konta: potwierdzenie i oczekująca zmiana e-maila, sposoby logowania,
 * 2FA (z wyłączeniem po utracie telefonu) i zalogowane urządzenia.
 */
export function SecuritySection({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages).user.security
  const user = viewModel.user
  if (!user) return null
  const { security } = user
  return (
    <Panel title={messages.title}>
      <dl className="space-y-4 text-[0.9375rem]">
        <div>
          <dt className="text-sm text-ink-soft">{messages.email}</dt>
          <dd>
            <span className="flex flex-wrap items-center gap-2 font-medium">
              <span className="break-all">{user.email}</span>
              {security.emailVerified ? (
                <Badge tone="success">
                  <Check aria-hidden className="size-3.5" />
                  {messages.verified}
                </Badge>
              ) : (
                <Badge tone="warning">{messages.unverified}</Badge>
              )}
            </span>
            {!security.emailVerified && !user.isDemo && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={viewModel.resending}
                onClick={viewModel.resend}
              >
                {messages.resend}
              </Button>
            )}
            {security.pendingEmail && (
              <span className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-muted/50 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 break-all">
                  {fmt(messages.pending, { email: security.pendingEmail })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={viewModel.canceling}
                  onClick={viewModel.cancelPending}
                >
                  {messages.cancelPending}
                </Button>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{messages.signIn}</dt>
          <dd className="font-medium">
            {[
              security.hasPassword && messages.password,
              security.google && messages.google,
            ]
              .filter(Boolean)
              .join(', ') || '–'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{messages.twoFactor}</dt>
          <dd className="flex flex-wrap items-center justify-between gap-2 font-medium">
            {security.twoFactor
              ? fmt(messages.twoFactorOn, { n: security.recoveryCodesLeft })
              : messages.twoFactorOff}
            {security.twoFactor && !viewModel.self && (
              <Button
                size="sm"
                variant="outline"
                disabled={viewModel.busy}
                onClick={() => viewModel.openDialog('twoFactor')}
              >
                {messages.disable2fa}
              </Button>
            )}
          </dd>
        </div>
      </dl>
      <Devices viewModel={viewModel} />
    </Panel>
  )
}

/** Zalogowane urządzenia z wylogowaniem pojedynczo albo wszystkich naraz. */
function Devices({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages).user.security
  const { tag } = useI18n()
  const stamp = (value: string) =>
    new Date(value).toLocaleString(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  return (
    <div className="mt-5 border-t border-line pt-5">
      <h3 className="font-semibold">{messages.devices}</h3>
      {viewModel.sessions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{messages.devicesEmpty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {viewModel.sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {session.label}
                  {session.ip && (
                    <span className="font-normal text-ink-soft">
                      {' '}
                      · {session.ip}
                    </span>
                  )}
                </span>
                <span className="block text-sm text-ink-soft">
                  {fmt(messages.deviceMeta, {
                    start: stamp(session.startedAt),
                    last: stamp(session.lastActiveAt),
                  })}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={viewModel.busy}
                aria-label={fmt(messages.signOutLabel, {
                  device: session.label,
                })}
                onClick={() =>
                  viewModel.revokeSession({
                    sessionId: session.id,
                    label: session.label,
                  })
                }
              >
                <LogOut aria-hidden className="size-4" />
                {messages.signOut}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[46ch] text-sm text-ink-soft">
          {messages.revokeAllHint}
        </p>
        <Button
          variant="outline"
          disabled={viewModel.busy}
          onClick={viewModel.revokeAll}
        >
          {messages.revokeAll}
        </Button>
      </div>
    </div>
  )
}
