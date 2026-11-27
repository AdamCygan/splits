import { createFileRoute } from '@tanstack/react-router'
import { StatusSettings } from '#/features/task-statuses/views/statuses-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/statuses')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.statuses.title} | ${site.name}`,
      },
    ],
  }),
  component: StatusSettings,
})
