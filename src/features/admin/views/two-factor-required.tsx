import { ShieldAlert } from 'lucide-react'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'

/** Panel zamknięty, dopóki admin nie włączy 2FA (ADMIN_REQUIRE_2FA=true na serwerze). */
export function TwoFactorRequired() {
  const t = useMessages(adminMessages).twoFactorRequired
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface px-6 py-8">
      <ShieldAlert aria-hidden className="mb-3 size-8 text-warn" />
      <h1 className="type-heading text-2xl">{t.title}</h1>
      <p className="mt-2 text-ink-soft">{t.text}</p>
    </div>
  )
}
