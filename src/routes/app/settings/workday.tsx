import { createFileRoute } from '@tanstack/react-router'
import { WorkdaySettings } from '#/features/settings/components/workday'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/workday')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.workday.title} | Pointhours`,
      },
    ],
  }),
  component: WorkdaySettings,
})
