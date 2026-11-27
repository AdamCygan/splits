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
export function SecuritySection({ vm }: SectionProps) {
  const t = useMessages(adminMessages).user.security
  const u = vm.user
  if (!u) return null
  const { security } = u
  return (
    <Panel title={t.title}>
      <dl className="space-y-4 text-[0.9375rem]">
        <div>
          <dt className="text-sm text-ink-soft">{t.email}</dt>
          <dd>
            <span className="flex flex-wrap items-center gap-2 font-medium">
              <span className="break-all">{u.email}</span>
              {security.emailVerified ? (
                <Badge tone="success">
                  <Check aria-hidden className="size-3.5" />
                  {t.verified}
                </Badge>
              ) : (
                <Badge tone="warning">{t.unverified}</Badge>
              )}
            </span>
            {!security.emailVerified && !u.isDemo && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={vm.resending}
                onClick={vm.resend}
              >
                {t.resend}
              </Button>
            )}
            {security.pendingEmail && (
              <span className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-muted/50 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 break-all">
                  {fmt(t.pending, { email: security.pendingEmail })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={vm.canceling}
                  onClick={vm.cancelPending}
                >
                  {t.cancelPending}
                </Button>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{t.signIn}</dt>
          <dd className="font-medium">
            {[security.hasPassword && t.password, security.google && t.google]
              .filter(Boolean)
              .join(', ') || '–'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{t.twoFactor}</dt>
          <dd className="flex flex-wrap items-center justify-between gap-2 font-medium">
            {security.twoFactor
              ? fmt(t.twoFactorOn, { n: security.recoveryCodesLeft })
              : t.twoFactorOff}
            {security.twoFactor && !vm.self && (
              <Button
                size="sm"
                variant="outline"
                disabled={vm.busy}
                onClick={() => vm.openDialog('twoFactor')}
              >
                {t.disable2fa}
              </Button>
            )}
          </dd>
        </div>
      </dl>
      <Devices vm={vm} />
    </Panel>
  )
}

/** Zalogowane urządzenia z wylogowaniem pojedynczo albo wszystkich naraz. */
function Devices({ vm }: SectionProps) {
  const t = useMessages(adminMessages).user.security
  const { tag } = useI18n()
  const stamp = (value: string) =>
    new Date(value).toLocaleString(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  return (
    <div className="mt-5 border-t border-line pt-5">
      <h3 className="font-semibold">{t.devices}</h3>
      {vm.sessions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t.devicesEmpty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {vm.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {s.label}
                  {s.ip && (
                    <span className="font-normal text-ink-soft"> · {s.ip}</span>
                  )}
                </span>
                <span className="block text-sm text-ink-soft">
                  {fmt(t.deviceMeta, {
                    start: stamp(s.startedAt),
                    last: stamp(s.lastActiveAt),
                  })}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={vm.busy}
                aria-label={fmt(t.signOutLabel, { device: s.label })}
                onClick={() =>
                  vm.revokeSession({ sessionId: s.id, label: s.label })
                }
              >
                <LogOut aria-hidden className="size-4" />
                {t.signOut}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[46ch] text-sm text-ink-soft">{t.revokeAllHint}</p>
        <Button variant="outline" disabled={vm.busy} onClick={vm.revokeAll}>
          {t.revokeAll}
        </Button>
      </div>
    </div>
  )
}
