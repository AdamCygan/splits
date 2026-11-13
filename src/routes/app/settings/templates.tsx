import { createFileRoute } from '@tanstack/react-router'
import { TemplateSettings } from '#/features/settings/components/templates'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings/templates')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.templates.title} | Splits`,
      },
    ],
  }),
  component: TemplateSettings,
})
