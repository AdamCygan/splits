import { queryOptions } from '@tanstack/react-query'
import { tagsApi } from '#/features/tags/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const tagsQuery = queryOptions({
  queryKey: keys.tags,
  queryFn: () => unwrap(tagsApi.list()),
})
