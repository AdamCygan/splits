import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { data } from '#/data'
import type { Bootstrap } from '#/data/types'
import { setCurrentUser } from '#/features/auth/session'
import { keys } from '#/features/settings/queries'
import { entryKeys } from '#/features/time-entries/queries'

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
      const result = await data.bootstrap()
      if (!result.ok) return false
      primeCache(client, result.value)
      return true
    },
  })
}
