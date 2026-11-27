import { queryOptions } from '@tanstack/react-query'
import { projectsApi } from '#/features/projects/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const projectsQuery = queryOptions({
  queryKey: keys.projects,
  queryFn: () => unwrap(projectsApi.list()),
})
