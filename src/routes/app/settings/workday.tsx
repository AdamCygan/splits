import { createFileRoute } from '@tanstack/react-router'
import { WorkdaySettings } from '#/features/settings/views/workday'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/workday')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.workday.title} | ${site.name}`,
      },
    ],
  }),
  component: WorkdaySettings,
})
