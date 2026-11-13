import { createFileRoute } from '@tanstack/react-router'
import { StoryPointSettings } from '#/features/settings/components/story-points'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/story-points')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.storyPoints.title} | Splits`,
      },
    ],
  }),
  component: StoryPointSettings,
})
