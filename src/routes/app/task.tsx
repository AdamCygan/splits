import { createFileRoute } from '@tanstack/react-router'
import { TaskPage } from '#/features/tasks/views/task-page'
import { getLocale } from '#/i18n/locale'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { site } from '#/config/site'

/** Zadanie nie ma własnego id: adres to typ pracy, tytuł i link (jak grupowanie w raporcie). */
interface TaskSearch {
  type: string
  title: string
  link?: string
}

export const Route = createFileRoute('/app/task')({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    type: typeof search.type === 'string' ? search.type : '',
    title: typeof search.title === 'string' ? search.title : '',
    ...(typeof search.link === 'string' && search.link
      ? { link: search.link }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: `${taskViewMessages[getLocale()].seoTitle} | ${site.name}` },
    ],
  }),
  component: TaskRoute,
})

function TaskRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TaskPage
      key={`${search.type}|${search.link ?? ''}|${search.title}`}
      task={{
        taskTypeId: search.type,
        title: search.title,
        link: search.link ?? null,
      }}
      onRename={(ref) =>
        void navigate({
          search: {
            type: ref.taskTypeId,
            title: ref.title,
            ...(ref.link ? { link: ref.link } : {}),
          },
          replace: true,
        })
      }
    />
  )
}
