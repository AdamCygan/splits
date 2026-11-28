import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { unwrap } from '#/lib/api-client'
import { feedbackApi } from './api'
import type { AdminFeedbackFilter } from './dto'

export const feedbackKeys = {
  all: ['feedback'] as const,
  mine: ['feedback', 'mine'] as const,
  admin: (filter: AdminFeedbackFilter) =>
    ['feedback', 'admin', filter] as const,
  /** Liczniki otwartych zgłoszeń (plakietka w menu admina). */
  adminOpen: ['feedback', 'admin', 'open'] as const,
}

export const myFeedbackQuery = queryOptions({
  queryKey: feedbackKeys.mine,
  queryFn: () => unwrap(feedbackApi.mine()),
})

export const adminFeedbackQuery = (filter: AdminFeedbackFilter) =>
  queryOptions({
    queryKey: feedbackKeys.admin(filter),
    queryFn: () => unwrap(feedbackApi.admin.list(filter)),
    placeholderData: keepPreviousData,
  })

/** Ile zgłoszeń czeka (nowe + w toku), odświeżane co minutę. */
export const adminFeedbackOpenQuery = queryOptions({
  queryKey: feedbackKeys.adminOpen,
  queryFn: async () =>
    (await unwrap(feedbackApi.admin.list({ status: 'new' }))).open,
  refetchInterval: 60_000,
  retry: false,
})
