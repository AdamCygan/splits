import { createFileRoute } from '@tanstack/react-router'
import { AccountSettings } from '#/features/settings/components/account'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/account')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.account.title} | ${site.name}`,
      },
    ],
  }),
  component: AccountSettings,
})
