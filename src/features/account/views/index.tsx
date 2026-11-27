import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { meQuery } from '../data/queries'
import {
  DemoNotice,
  QueryView,
  SectionHeader,
} from '#/features/settings/views/ui'
import { DeleteAccountCard } from './delete-account-card'
import { ExportDataCard } from './export-data-card'
import { LanguageCard } from './language-card'
import { PasswordCard } from './password-card'
import { ProfileCard } from './profile-card'

export { IdentityFields } from './identity-fields'
export { PasswordCard } from './password-card'

/**
 * Ustawienia → Konto (MVVM: widoki tu, stan w use-*.ts): profil z e-mailem tylko do
 * odczytu i zmianą przez link, język, hasło, eksport danych i usunięcie konta kodem.
 * Konto demo ma tylko język i eksport (usuwa się samo po 24 godzinach).
 */
export function AccountSettings() {
  const t = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.sections.account.title}
        lead={t.sections.account.text}
      />
      <QueryView query={meQuery} skeletonRows={3}>
        {(user) =>
          user.isDemo ? (
            <>
              <DemoNotice />
              <LanguageCard />
              <ExportDataCard />
            </>
          ) : (
            <>
              <ProfileCard user={user} />
              <LanguageCard />
              <PasswordCard hasPassword={user.hasPassword} />
              <ExportDataCard />
              <DeleteAccountCard user={user} />
            </>
          )
        }
      </QueryView>
    </div>
  )
}
