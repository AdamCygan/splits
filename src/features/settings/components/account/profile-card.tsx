import type { User } from '#/features/auth/data/dto'
import { Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { LIMITS } from '#/domain/rules'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { SaveBar, SettingsCard } from '../ui'
import { EmailChangeDialog } from './email-change-dialog'
import { EmailField } from './email-field'
import { useEmailViewModel } from './use-email'
import { useProfileViewModel } from './use-profile'

export interface ProfileCardProps {
  user: User
}

/** Login (stały), wyświetlana nazwa (edycja z paskiem zapisu) i e-mail ze zmianą przez link. */
export function ProfileCard({ user }: ProfileCardProps) {
  const t = useMessages(settingsMessages).account
  const vm = useProfileViewModel(user)
  const email = useEmailViewModel(user)
  return (
    <>
      <form noValidate onSubmit={vm.submit}>
        <SettingsCard title={t.profileTitle} lead={t.profileLead}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.username} hint={t.usernameHint}>
              {(a) => (
                <Input
                  {...a}
                  value={user.username}
                  readOnly
                  className="bg-muted/60"
                />
              )}
            </Field>
            <Field label={t.displayName} error={vm.nameError}>
              {(a) => (
                <Input
                  {...a}
                  autoComplete="name"
                  maxLength={LIMITS.displayName}
                  value={vm.displayName}
                  onChange={(e) => vm.setDisplayName(e.target.value)}
                />
              )}
            </Field>
            <EmailField vm={email} />
          </div>
        </SettingsCard>
        <SaveBar dirty={vm.dirty} saving={vm.saving} onDiscard={vm.discard} />
      </form>
      {/* Poza formularzem profilu: zdarzenia z portalu okna nie trafiają do jego onSubmit. */}
      {email.open && <EmailChangeDialog vm={email} />}
    </>
  )
}
