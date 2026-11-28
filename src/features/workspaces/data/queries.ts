import { queryOptions } from '@tanstack/react-query'
import { unwrap } from '#/lib/api-client'
import { appApi } from '#/features/app/data/api'
import { workspacesApi } from './api'

export const workspaceKeys = {
  state: ['workspaces'] as const,
  /** Timer z innej przestrzeni (z /bootstrap; odświeżany razem z nim). */
  elsewhere: ['running-elsewhere'] as const,
}

/** Przestrzenie konta, bieżąca i preferencje (zwykle już z /bootstrap). */
export const workspacesQuery = queryOptions({
  queryKey: workspaceKeys.state,
  queryFn: () => unwrap(workspacesApi.state()),
  staleTime: 60_000,
})

/** Timer działający w innej przestrzeni niż bieżąca (null = brak). */
export const runningElsewhereQuery = queryOptions({
  queryKey: workspaceKeys.elsewhere,
  queryFn: async () => (await unwrap(appApi.bootstrap())).runningElsewhere,
  staleTime: Infinity,
})
