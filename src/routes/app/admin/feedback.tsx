import { createFileRoute } from '@tanstack/react-router'
import type { AdminFeedbackFilter } from '#/features/feedback/data/dto'
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
} from '#/features/feedback/domain/feedback'
import { FeedbackInbox } from '#/features/feedback/views/feedback-inbox'

const STATUS_FILTERS: ReadonlyArray<string> = [...FEEDBACK_STATUSES, 'open']

/** Filtry skrzynki z adresu strony; domyślnie otwarte zgłoszenia. */
const parseFilter = (search: Record<string, unknown>): AdminFeedbackFilter => ({
  status:
    search.status === 'all'
      ? undefined
      : STATUS_FILTERS.includes(String(search.status))
        ? (search.status as AdminFeedbackFilter['status'])
        : 'open',
  ...(FEEDBACK_KINDS.includes(search.kind as never)
    ? { kind: search.kind as AdminFeedbackFilter['kind'] }
    : {}),
  ...(Number(search.page) > 1 ? { page: Math.floor(Number(search.page)) } : {}),
})

export const Route = createFileRoute('/app/admin/feedback')({
  validateSearch: (search: Record<string, unknown>) => parseFilter(search),
  component: AdminFeedbackRoute,
})

function AdminFeedbackRoute() {
  const filter = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <FeedbackInbox
      filter={filter}
      onFilter={(next) =>
        void navigate({
          search: { ...next, status: next.status ?? 'all' } as never,
          replace: true,
        })
      }
    />
  )
}
