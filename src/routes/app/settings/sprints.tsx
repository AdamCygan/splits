import { createFileRoute } from '@tanstack/react-router'
import { SprintSettings } from '#/features/settings/components/sprints'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/sprints')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.sprints.title} | Pointhours`,
      },
    ],
  }),
  component: SprintSettings,
})
