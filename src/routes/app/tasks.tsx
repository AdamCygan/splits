import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from '#/features/tasks/tasks-page'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'

export const Route = createFileRoute('/app/tasks')({
  head: () => ({
    meta: [
      { title: `${panelMessages[getLocale()].tasks.seoTitle} | Pointhours` },
    ],
  }),
  component: TasksPage,
})
