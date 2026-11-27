import { createFileRoute } from '@tanstack/react-router'
import { SprintSettings } from '#/features/sprints/views/sprints-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/sprints')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.sprints.title} | ${site.name}`,
      },
    ],
  }),
  component: SprintSettings,
})
