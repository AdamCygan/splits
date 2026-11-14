import { createFileRoute } from '@tanstack/react-router'
import { SummarySettings } from '#/features/settings/components/summaries'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/summaries')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.summaries.title} | Pointhours`,
      },
    ],
  }),
  component: SummarySettings,
})
