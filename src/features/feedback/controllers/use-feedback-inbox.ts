import { useQuery } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { feedbackMessages } from '#/i18n/messages/feedback'
import { useDataMutation } from '#/shared/data/mutations'
import { feedbackApi } from '../data/api'
import type {
  AdminFeedback,
  AdminFeedbackChange,
  AdminFeedbackFilter,
} from '../data/dto'
import { adminFeedbackQuery, feedbackKeys } from '../data/queries'

export interface FeedbackInboxOptions {
  /** Filtry z adresu strony. */
  filter: AdminFeedbackFilter
  onFilter: (next: AdminFeedbackFilter) => void
}

/** ViewModel skrzynki zgłoszeń: filtry w adresie, stronicowanie, liczniki otwartych. */
export function useFeedbackInbox({ filter, onFilter }: FeedbackInboxOptions) {
  const inbox = useQuery(adminFeedbackQuery(filter))
  const update = (patch: Partial<AdminFeedbackFilter>) =>
    onFilter({ ...filter, ...patch, page: patch.page })
  const data = inbox.data
  return {
    filter,
    items: data?.items ?? [],
    pending: inbox.isPending,
    total: data?.total ?? 0,
    open: data?.open ?? { new: 0, inProgress: 0 },
    page: filter.page ?? 1,
    pages: data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1,
    setStatus: (status: AdminFeedbackFilter['status']) => update({ status }),
    setKind: (kind: AdminFeedbackFilter['kind']) => update({ kind }),
    setPage: (page: number) => update({ page }),
  }
}

export type FeedbackInboxViewModel = ReturnType<typeof useFeedbackInbox>

/** Zapis stanu, odpowiedzi i notatki jednego zgłoszenia. */
export function useUpdateFeedback(report: AdminFeedback) {
  const messages = useMessages(feedbackMessages).admin
  return useDataMutation(
    (change: AdminFeedbackChange) =>
      feedbackApi.admin.update(report.id, change),
    {
      invalidate: [feedbackKeys.all],
      success: (_saved, change) =>
        change.reply && change.reply !== report.reply
          ? fmt(messages.replied, { email: report.user.email })
          : messages.saved,
    },
  )
}
