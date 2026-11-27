import { Check, MailWarning } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import type { EmailViewModel } from './use-email'

export interface EmailFieldProps {
  vm: EmailViewModel
}

/**
 * E-mail tylko do odczytu ze stanem potwierdzenia i przyciskiem „Zmień”. Pod spodem:
 * prośba o potwierdzenie (z ponownym wysłaniem linku) albo oczekująca zmiana adresu.
 */
export function EmailField({ vm }: EmailFieldProps) {
  const t = useMessages(settingsMessages)
  const s = t.security
  return (
    <div className="sm:col-span-2">
      <Field
        label={t.account.email}
        hint={
          vm.verified ? undefined : fmt(s.unverifiedText, { email: vm.email })
        }
      >
        {(a) => (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              {...a}
              type="email"
              value={vm.email}
              readOnly
              className="min-w-0 flex-1 bg-muted/60 sm:max-w-md"
            />
            {vm.verified ? (
              <Badge tone="success">
                <Check aria-hidden className="size-3.5" />
                {s.verified}
              </Badge>
            ) : (
              <Badge tone="warning">{s.unverified}</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              aria-label={t.account.changeEmailLabel}
              onClick={vm.openChange}
            >
              {t.account.changeEmail}
            </Button>
          </div>
        )}
      </Field>
      {!vm.verified && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={vm.resending}
          onClick={vm.resend}
        >
          {s.resend}
        </Button>
      )}
      {vm.pendingEmail && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm"
        >
          <MailWarning aria-hidden className="size-4 shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            {fmt(s.pending, { email: vm.pendingEmail })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={vm.canceling}
            onClick={vm.cancelPending}
          >
            {s.cancelPending}
          </Button>
        </div>
      )}
    </div>
  )
}
