import { createFileRoute } from '@tanstack/react-router'
import { ProjectSettings } from '#/features/settings/components/projects'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/projects')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.projects.title} | Pointhours`,
      },
    ],
  }),
  component: ProjectSettings,
})
