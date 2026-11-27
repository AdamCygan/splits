import { queryOptions } from '@tanstack/react-query'
import { taskTypesApi } from '#/features/task-types/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const taskTypesQuery = queryOptions({
  queryKey: keys.taskTypes,
  queryFn: () => unwrap(taskTypesApi.list()),
})
