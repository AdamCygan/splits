import { queryOptions } from '@tanstack/react-query'
import { spScaleApi } from '#/features/story-points/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const scaleQuery = queryOptions({
  queryKey: keys.scale,
  queryFn: () => unwrap(spScaleApi.get()),
})
