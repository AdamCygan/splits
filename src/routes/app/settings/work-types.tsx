import { createFileRoute } from '@tanstack/react-router'
import { WorkTypeSettings } from '#/features/task-types/views/work-types-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/work-types')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.workTypes.title} | ${site.name}`,
      },
    ],
  }),
  component: WorkTypeSettings,
})
