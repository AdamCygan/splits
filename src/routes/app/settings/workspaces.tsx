import { createFileRoute } from '@tanstack/react-router'
import { WorkspacesSettings } from '#/features/workspaces/views/workspaces-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/workspaces')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.workspaces.title} | ${site.name}`,
      },
    ],
  }),
  component: WorkspacesSettings,
})
