import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { appApi } from './api'
import type { Bootstrap } from '#/features/app/data/dto'
import { setCurrentUser } from '#/features/auth/data/session'
import { keys } from '#/shared/data/query-keys'
import { entryKeys } from '#/features/time-entries/data/queries'
import { workspaceKeys } from '#/features/workspaces/data/queries'

/** Rozkłada odpowiedź /bootstrap do pamięci zapytań, pod te same klucze co pojedyncze endpointy. */
export function primeCache(client: QueryClient, boot: Bootstrap) {
  client.setQueryData(keys.me, boot.user)
  client.setQueryData(keys.settings, boot.settings)
  client.setQueryData(keys.taskTypes, boot.taskTypes)
  client.setQueryData(keys.scale, boot.scale)
  client.setQueryData(keys.projects, boot.projects)
  client.setQueryData(keys.templates, boot.templates)
  client.setQueryData(entryKeys.day(boot.today), boot.entries)
  client.setQueryData(entryKeys.paused, boot.paused)
  client.setQueryData(entryKeys.running, boot.running)
  client.setQueryData(workspaceKeys.state, boot.workspaces)
  client.setQueryData(workspaceKeys.elsewhere, boot.runningElsewhere)
  setCurrentUser(boot.user)
}

/**
 * Start panelu: jedno żądanie zamiast ośmiu. Ekrany czytają potem dane zwykłymi zapytaniami,
 * które trafiają w gotową pamięć. Gdy /bootstrap zawiedzie, panel i tak się otwiera,
 * a każde zapytanie pobiera swoje dane samo (jak wcześniej).
 */
export function useBootstrap() {
  const client = useQueryClient()
  return useQuery({
    queryKey: ['bootstrap'],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 0,
    queryFn: async () => {
      const result = await appApi.bootstrap()
      if (!result.ok) return false
      primeCache(client, result.value)
      return true
    },
  })
}
