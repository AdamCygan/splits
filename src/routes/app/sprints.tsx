import { createFileRoute } from '@tanstack/react-router'
import { SprintsPage } from '#/features/sprints/sprints-page'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'

export const Route = createFileRoute('/app/sprints')({
  head: () => ({
    meta: [
      { title: `${panelMessages[getLocale()].sprints.seoTitle} | Splits` },
    ],
  }),
  component: SprintsPage,
})
