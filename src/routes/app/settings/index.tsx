import { createFileRoute } from '@tanstack/react-router'
import { SettingsOverview } from '#/features/settings/components/overview'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.overview.title} | Pointhours`,
      },
    ],
  }),
  component: SettingsOverview,
})
