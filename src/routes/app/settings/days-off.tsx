import { createFileRoute } from '@tanstack/react-router'
import { DaysOffSettings } from '#/features/days-off/days-off-settings'
import { getLocale } from '#/i18n/locale'
import { daysOffMessages } from '#/i18n/messages/days-off'

export const Route = createFileRoute('/app/settings/days-off')({
  head: () => ({
    meta: [
      {
        title: `${daysOffMessages[getLocale()].settings.seoTitle} | Pointhours`,
      },
    ],
  }),
  component: DaysOffSettings,
})
