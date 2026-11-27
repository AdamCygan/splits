import { createFileRoute } from '@tanstack/react-router'
import type { AdminUserFilter } from '#/features/admin/data/dto'
import { parseUserSearch } from '#/features/admin/model'
import { AdminUsersPage } from '#/features/admin/users-page'

export const Route = createFileRoute('/app/admin/')({
  validateSearch: (search: Record<string, unknown>): AdminUserFilter =>
    parseUserSearch(search),
  component: AdminUsersRoute,
})

function AdminUsersRoute() {
  const filter = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminUsersPage
      filter={filter}
      onFilter={(next) => void navigate({ search: next, replace: true })}
    />
  )
}
