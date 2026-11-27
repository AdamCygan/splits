import { settingsApi } from './api'
import { queryOptions } from '@tanstack/react-query'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const settingsQuery = queryOptions({
  queryKey: keys.settings,
  queryFn: () => unwrap(settingsApi.get()),
})
