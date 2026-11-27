import { createFileRoute } from '@tanstack/react-router'
import { TasksPage } from '#/features/tasks/views/tasks-page'
import { getLocale } from '#/i18n/locale'
import { panelMessages } from '#/i18n/messages/panel'
import { site } from '#/config/site'

interface TasksSearch {
  sprint?: string
}

export const Route = createFileRoute('/app/tasks')({
  /** ?sprint=<id>: zadania z danego sprintu (np. link ze strony Sprinty). */
  validateSearch: (search: Record<string, unknown>): TasksSearch =>
    typeof search.sprint === 'string' && search.sprint
      ? { sprint: search.sprint }
      : {},
  head: () => ({
    meta: [
      { title: `${panelMessages[getLocale()].tasks.seoTitle} | ${site.name}` },
    ],
  }),
  component: TasksRoute,
})

function TasksRoute() {
  const { sprint } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TasksPage
      sprint={sprint}
      onSprintChange={(id) =>
        void navigate({ search: id ? { sprint: id } : {}, replace: true })
      }
    />
  )
}
