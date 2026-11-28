import type { User } from '#/features/auth/data/dto'
import { Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { LIMITS } from '#/features/task-types/domain/rules'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { SaveBar, SettingsCard } from '#/features/settings/views/ui'
import { EmailChangeDialog } from './email-change-dialog'
import { EmailField } from './email-field'
import { useEmailViewModel } from '../controllers/use-email'
import { useProfileViewModel } from '../controllers/use-profile'

export interface ProfileCardProps {
  user: User
}

/** Login (stały), wyświetlana nazwa (edycja z paskiem zapisu) i e-mail ze zmianą przez link. */
export function ProfileCard({ user }: ProfileCardProps) {
  const messages = useMessages(settingsMessages).account
  const viewModel = useProfileViewModel(user)
  const email = useEmailViewModel(user)
  return (
    <>
      <form noValidate onSubmit={viewModel.submit}>
        <SettingsCard title={messages.profileTitle} lead={messages.profileLead}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={messages.username} hint={messages.usernameHint}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={user.username}
                  readOnly
                  className="bg-muted/60"
                />
              )}
            </Field>
            <Field label={messages.displayName} error={viewModel.nameError}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  autoComplete="name"
                  maxLength={LIMITS.displayName}
                  value={viewModel.displayName}
                  onChange={(event) =>
                    viewModel.setDisplayName(event.target.value)
                  }
                />
              )}
            </Field>
            <EmailField viewModel={email} />
          </div>
        </SettingsCard>
        <SaveBar
          dirty={viewModel.dirty}
          saving={viewModel.saving}
          onDiscard={viewModel.discard}
        />
      </form>
      {/* Poza formularzem profilu: zdarzenia z portalu okna nie trafiają do jego onSubmit. */}
      {email.open && <EmailChangeDialog viewModel={email} />}
    </>
  )
}
