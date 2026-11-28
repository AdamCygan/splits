import { Check, MailWarning } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import type { EmailViewModel } from '../controllers/use-email'

export interface EmailFieldProps {
  viewModel: EmailViewModel
}

/**
 * E-mail tylko do odczytu ze stanem potwierdzenia i przyciskiem „Zmień”. Pod spodem:
 * prośba o potwierdzenie (z ponownym wysłaniem linku) albo oczekująca zmiana adresu.
 */
export function EmailField({ viewModel }: EmailFieldProps) {
  const messages = useMessages(settingsMessages)
  const security = messages.security
  return (
    <div className="sm:col-span-2">
      <Field
        label={messages.account.email}
        hint={
          viewModel.verified
            ? undefined
            : fmt(security.unverifiedText, { email: viewModel.email })
        }
      >
        {(fieldProps) => (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              {...fieldProps}
              type="email"
              value={viewModel.email}
              readOnly
              className="min-w-0 flex-1 bg-muted/60 sm:max-w-md"
            />
            {viewModel.verified ? (
              <Badge tone="success">
                <Check aria-hidden className="size-3.5" />
                {security.verified}
              </Badge>
            ) : (
              <Badge tone="warning">{security.unverified}</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              aria-label={messages.account.changeEmailLabel}
              onClick={viewModel.openChange}
            >
              {messages.account.changeEmail}
            </Button>
          </div>
        )}
      </Field>
      {!viewModel.verified && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={viewModel.resending}
          onClick={viewModel.resend}
        >
          {security.resend}
        </Button>
      )}
      {viewModel.pendingEmail && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm"
        >
          <MailWarning aria-hidden className="size-4 shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            {fmt(security.pending, { email: viewModel.pendingEmail })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={viewModel.canceling}
            onClick={viewModel.cancelPending}
          >
            {security.cancelPending}
          </Button>
        </div>
      )}
    </div>
  )
}
