import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminLayout } from '#/features/admin/admin-layout'
import { getLocale } from '#/i18n/locale'
import { adminMessages } from '#/i18n/messages/admin'

/**
 * Panel administratora. Przekierowanie to tylko wygoda: dostępu pilnuje serwer,
 * który przy każdym żądaniu /api/v1/admin sprawdza rolę w bazie.
 */
export const Route = createFileRoute('/app/admin')({
  beforeLoad: async () => {
    const { getCurrentUser } = await import('#/features/auth/session')
    if (getCurrentUser()?.role !== 'admin') throw redirect({ to: '/app' })
  },
  head: () => ({
    meta: [{ title: `${adminMessages[getLocale()].seoTitle} | Pointhours` }],
  }),
  component: AdminLayout,
})
