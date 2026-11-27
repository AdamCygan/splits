import { createFileRoute } from '@tanstack/react-router'
import { ProjectSettings } from '#/features/projects/views/projects-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/projects')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.projects.title} | ${site.name}`,
      },
    ],
  }),
  component: ProjectSettings,
})
