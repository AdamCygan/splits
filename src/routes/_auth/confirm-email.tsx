import { createFileRoute } from '@tanstack/react-router'
import { ConfirmEmailPage } from '#/features/auth/views/confirm-email'
import { isEmailToken } from '#/features/auth/domain/email-token'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { seo } from '#/lib/seo'

interface ConfirmEmailSearch {
  token?: string
}

export const Route = createFileRoute('/_auth/confirm-email')({
  validateSearch: (search: Record<string, unknown>): ConfirmEmailSearch =>
    isEmailToken(search.token) ? { token: search.token } : {},
  head: () =>
    seo({
      title: authMessages[getLocale()].confirmEmail.seoTitle,
      path: '/confirm-email',
      noindex: true,
    }),
  component: ConfirmEmailRoute,
})

function ConfirmEmailRoute() {
  const { token } = Route.useSearch()
  return <ConfirmEmailPage token={token} />
}
