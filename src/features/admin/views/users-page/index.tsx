import { SectionHeader } from '#/features/settings/views/ui'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { StatsPanel } from './stats-panel'
import { UserFilters } from './user-filters'
import { UsersTable } from './users-table'
import { useUsersPageViewModel } from '../../controllers/use-users-page'
import type { UsersPageOptions } from '../../controllers/use-users-page'

export type AdminUsersPageProps = UsersPageOptions

/** Panel admina → Użytkownicy (MVVM): liczby, filtry z adresu strony i lista kont. */
export function AdminUsersPage(props: AdminUsersPageProps) {
  const messages = useMessages(adminMessages)
  const viewModel = useUsersPageViewModel(props)
  return (
    <>
      <SectionHeader title={messages.title} lead={messages.lead} />
      <StatsPanel stats={viewModel.stats} />
      <UserFilters viewModel={viewModel} />
      <UsersTable viewModel={viewModel} />
    </>
  )
}
