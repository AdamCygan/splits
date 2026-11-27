import { queryOptions } from '@tanstack/react-query'
import { statusesApi } from '#/features/task-statuses/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const statusesQuery = queryOptions({
  queryKey: keys.statuses,
  queryFn: () => unwrap(statusesApi.list()),
})
