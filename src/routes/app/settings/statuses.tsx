import { createFileRoute } from '@tanstack/react-router'
import { StatusSettings } from '#/features/settings/components/statuses'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/statuses')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.statuses.title} | Pointhours`,
      },
    ],
  }),
  component: StatusSettings,
})
