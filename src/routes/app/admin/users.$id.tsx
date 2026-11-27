import { createFileRoute } from '@tanstack/react-router'
import { AdminUserPage } from '#/features/admin/views/user-page'

export const Route = createFileRoute('/app/admin/users/$id')({
  component: AdminUserRoute,
})

function AdminUserRoute() {
  const { id } = Route.useParams()
  // key: przejście na inne konto zaczyna ze świeżym stanem okien i formularzy.
  return <AdminUserPage key={id} id={id} />
}
