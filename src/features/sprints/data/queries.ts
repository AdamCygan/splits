import { queryOptions } from '@tanstack/react-query'
import { sprintsApi } from '#/features/sprints/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const cadenceQuery = queryOptions({
  queryKey: keys.cadence,
  queryFn: () => unwrap(sprintsApi.getCadence()),
})

export const sprintsQuery = queryOptions({
  queryKey: keys.sprints,
  queryFn: () => unwrap(sprintsApi.list()),
})
