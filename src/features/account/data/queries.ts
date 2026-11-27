import { queryOptions } from '@tanstack/react-query'
import { accountApi } from '#/features/account/data/api'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const meQuery = queryOptions({
  queryKey: keys.me,
  queryFn: () => unwrap(accountApi.me()),
})

export const securityQuery = queryOptions({
  queryKey: keys.security,
  queryFn: () => unwrap(accountApi.security()),
})

export const sessionsQuery = queryOptions({
  queryKey: keys.sessions,
  queryFn: () => unwrap(accountApi.sessions()),
})
