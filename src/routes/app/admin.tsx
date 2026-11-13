import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminPage } from '#/features/admin/admin-page'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'

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
    meta: [{ title: `${panelMessages[getLocale()].admin.seoTitle} | Splits` }],
  }),
  component: AdminPage,
})
