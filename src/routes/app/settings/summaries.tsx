import { createFileRoute } from '@tanstack/react-router'
import { SummarySettings } from '#/features/settings/views/summaries'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/summaries')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.summaries.title} | ${site.name}`,
      },
    ],
  }),
  component: SummarySettings,
})
