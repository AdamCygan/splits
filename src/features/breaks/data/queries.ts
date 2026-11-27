import { queryOptions } from '@tanstack/react-query'
import { breaksApi } from '#/features/breaks/data/api'
import { unwrap } from '#/lib/api-client'

/** Przerwy w pracy: lista z dnia i trwająca przerwa. */
export const breakKeys = { all: ['breaks'] as const }

export const breaksQuery = (date: string) =>
  queryOptions({
    queryKey: [...breakKeys.all, 'day', date],
    queryFn: () => unwrap(breaksApi.list(date)),
  })

export const runningBreakQuery = queryOptions({
  queryKey: [...breakKeys.all, 'running'],
  queryFn: () => unwrap(breaksApi.running()),
})
