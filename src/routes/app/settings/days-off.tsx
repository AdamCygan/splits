import { createFileRoute } from '@tanstack/react-router'
import { DaysOffSettings } from '#/features/days-off/views/days-off-settings'
import { getLocale } from '#/i18n/locale'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/settings/days-off')({
  head: () => ({
    meta: [
      {
        title: `${daysOffMessages[getLocale()].settings.seoTitle} | ${site.name}`,
      },
    ],
  }),
  component: DaysOffSettings,
})
