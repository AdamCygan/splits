import { createFileRoute } from '@tanstack/react-router'
import type { AdminActionFilter } from '#/data/types'
import { AdminLogPage } from '#/features/admin/log-page'
import { parseActionSearch } from '#/features/admin/model'

export const Route = createFileRoute('/app/admin/log')({
  validateSearch: (search: Record<string, unknown>): AdminActionFilter =>
    parseActionSearch(search),
  component: AdminLogRoute,
})

function AdminLogRoute() {
  const filter = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminLogPage
      filter={filter}
      onFilter={(next) => void navigate({ search: next, replace: true })}
    />
  )
}
