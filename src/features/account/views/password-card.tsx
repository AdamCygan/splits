import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { SettingsCard } from '#/features/settings/views/ui'
import { usePasswordViewModel } from '../controllers/use-password'

export interface PasswordCardProps {
  hasPassword: boolean
}

/** Zmiana hasła albo ustawienie pierwszego (konto z Google). */
export function PasswordCard({ hasPassword }: PasswordCardProps) {
  const messages = useMessages(settingsMessages).account
  const viewModel = usePasswordViewModel(hasPassword)
  return (
    <form noValidate onSubmit={viewModel.submit}>
      <SettingsCard
        title={hasPassword ? messages.passwordTitle : messages.setPasswordTitle}
        lead={hasPassword ? messages.passwordLead : messages.setPasswordLead}
      >
        <div className="grid max-w-md gap-5">
          {hasPassword && (
            <Field
              label={messages.currentPassword}
              error={viewModel.errors.current}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="current-password"
                  value={viewModel.draft.current}
                  onChange={(event) =>
                    viewModel.update({ current: event.target.value })
                  }
                />
              )}
            </Field>
          )}
          <Field label={messages.newPassword} error={viewModel.errors.next}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                autoComplete="new-password"
                value={viewModel.draft.next}
                onChange={(event) =>
                  viewModel.update({ next: event.target.value })
                }
              />
            )}
          </Field>
          <Field
            label={messages.confirmPassword}
            error={viewModel.errors.confirm}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                autoComplete="new-password"
                value={viewModel.draft.confirm}
                onChange={(event) =>
                  viewModel.update({ confirm: event.target.value })
                }
              />
            )}
          </Field>
          <Button
            type="submit"
            className="w-fit"
            disabled={viewModel.saving}
            aria-busy={viewModel.saving}
          >
            {messages.changePassword}
          </Button>
        </div>
      </SettingsCard>
    </form>
  )
}
