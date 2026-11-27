import { createFileRoute } from '@tanstack/react-router'
import { SprintsPage } from '#/features/sprints/views/sprints-page'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'
import { site } from '#/config/site'

export const Route = createFileRoute('/app/sprints')({
  head: () => ({
    meta: [
      {
        title: `${panelMessages[getLocale()].sprints.seoTitle} | ${site.name}`,
      },
    ],
  }),
  component: SprintsPage,
})
