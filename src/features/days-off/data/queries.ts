import { queryOptions } from '@tanstack/react-query'
import { daysOffApi } from '#/features/days-off/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

/** Dni wolne w zakresie dat (urlop, L4, święta). */
export const daysOffQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: [...keys.daysOff, from, to],
    queryFn: () => unwrap(daysOffApi.list(from, to)),
  })
