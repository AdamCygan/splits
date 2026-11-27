import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { adminApi } from './data/api'
import type {
  AdminActionFilter,
  AdminUserFilter,
} from '#/features/admin/data/dto'
import { unwrap } from '#/lib/api-client'

export const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  users: (filter: AdminUserFilter) => ['admin', 'users', filter] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  invoices: (id: string) => ['admin', 'invoices', id] as const,
  actions: (filter: AdminActionFilter) => ['admin', 'actions', filter] as const,
}

export const adminStatsQuery = queryOptions({
  queryKey: adminKeys.stats,
  queryFn: () => unwrap(adminApi.stats()),
  // Brak dostępu (np. wymagane 2FA) nie jest chwilowym błędem: bez ponawiania.
  retry: false,
})

export const adminUsersQuery = (filter: AdminUserFilter) =>
  queryOptions({
    queryKey: adminKeys.users(filter),
    queryFn: () => unwrap(adminApi.users(filter)),
    placeholderData: keepPreviousData,
  })

export const adminUserQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.user(id),
    queryFn: () => unwrap(adminApi.user(id)),
    retry: false,
  })

export const adminInvoicesQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.invoices(id),
    queryFn: () => unwrap(adminApi.invoices(id)),
  })

export const adminActionsQuery = (filter: AdminActionFilter) =>
  queryOptions({
    queryKey: adminKeys.actions(filter),
    queryFn: () => unwrap(adminApi.actions(filter)),
    placeholderData: keepPreviousData,
  })
