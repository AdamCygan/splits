import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { SettingsCard } from '../ui'
import { usePasswordViewModel } from './use-password'

export interface PasswordCardProps {
  hasPassword: boolean
}

/** Zmiana hasła albo ustawienie pierwszego (konto z Google). */
export function PasswordCard({ hasPassword }: PasswordCardProps) {
  const t = useMessages(settingsMessages).account
  const vm = usePasswordViewModel(hasPassword)
  return (
    <form noValidate onSubmit={vm.submit}>
      <SettingsCard
        title={hasPassword ? t.passwordTitle : t.setPasswordTitle}
        lead={hasPassword ? t.passwordLead : t.setPasswordLead}
      >
        <div className="grid max-w-md gap-5">
          {hasPassword && (
            <Field label={t.currentPassword} error={vm.errors.current}>
              {(a) => (
                <Input
                  {...a}
                  type="password"
                  autoComplete="current-password"
                  value={vm.draft.current}
                  onChange={(e) => vm.update({ current: e.target.value })}
                />
              )}
            </Field>
          )}
          <Field label={t.newPassword} error={vm.errors.next}>
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="new-password"
                value={vm.draft.next}
                onChange={(e) => vm.update({ next: e.target.value })}
              />
            )}
          </Field>
          <Field label={t.confirmPassword} error={vm.errors.confirm}>
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="new-password"
                value={vm.draft.confirm}
                onChange={(e) => vm.update({ confirm: e.target.value })}
              />
            )}
          </Field>
          <Button
            type="submit"
            className="w-fit"
            disabled={vm.saving}
            aria-busy={vm.saving}
          >
            {t.changePassword}
          </Button>
        </div>
      </SettingsCard>
    </form>
  )
}
