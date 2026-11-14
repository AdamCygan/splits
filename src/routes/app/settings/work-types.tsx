import { createFileRoute } from '@tanstack/react-router'
import { WorkTypeSettings } from '#/features/settings/components/work-types'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/work-types')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.workTypes.title} | Pointhours`,
      },
    ],
  }),
  component: WorkTypeSettings,
})
