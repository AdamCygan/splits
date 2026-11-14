import { createFileRoute } from '@tanstack/react-router'
import { AccountSettings } from '#/features/settings/components/account'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/account')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.account.title} | Pointhours`,
      },
    ],
  }),
  component: AccountSettings,
})
