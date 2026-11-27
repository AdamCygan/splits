import { createFileRoute } from '@tanstack/react-router'
import { TemplateSettings } from '#/features/templates/views/templates-settings'
import { getLocale } from '#/i18n/locale'
import { settingsMessages } from '#/i18n/messages/settings'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/templates')({
  head: () => ({
    meta: [
      {
        title: `${settingsMessages[getLocale()].sections.templates.title} | ${site.name}`,
      },
    ],
  }),
  component: TemplateSettings,
})
