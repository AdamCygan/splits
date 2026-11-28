import { createFileRoute } from '@tanstack/react-router'
import { site } from '#/config/site'
import { HelpSettings } from '#/features/feedback/views/help-settings'
import { getLocale } from '#/i18n/locale'
import { feedbackMessages } from '#/i18n/messages/feedback'

export const Route = createFileRoute('/app/settings/help')({
  head: () => ({
    meta: [
      {
        title: `${feedbackMessages[getLocale()].help.seoTitle} | ${site.name}`,
      },
    ],
  }),
  component: HelpSettings,
})
