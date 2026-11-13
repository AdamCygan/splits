import { createFileRoute } from '@tanstack/react-router'
import { TodayPage } from '#/features/time-entries/components/today'
import { getLocale } from '#/i18n/locale'
import { entriesMessages } from '#/i18n/messages/entries'

export const Route = createFileRoute('/app/')({
  head: () => ({
    meta: [{ title: `${entriesMessages[getLocale()].pageTitle} | Splits` }],
  }),
  component: TodayPage,
})
