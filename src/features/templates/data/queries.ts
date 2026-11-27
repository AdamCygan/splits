import { queryOptions } from '@tanstack/react-query'
import { templatesApi } from '#/features/templates/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const templatesQuery = queryOptions({
  queryKey: keys.templates,
  queryFn: () => unwrap(templatesApi.list()),
})
