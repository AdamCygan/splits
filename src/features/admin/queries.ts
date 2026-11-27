import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { data } from '#/data'
import type { AdminActionFilter, AdminUserFilter } from '#/data/types'
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
  queryFn: () => unwrap(data.admin.stats()),
  // Brak dostępu (np. wymagane 2FA) nie jest chwilowym błędem: bez ponawiania.
  retry: false,
})

export const adminUsersQuery = (filter: AdminUserFilter) =>
  queryOptions({
    queryKey: adminKeys.users(filter),
    queryFn: () => unwrap(data.admin.users(filter)),
    placeholderData: keepPreviousData,
  })

export const adminUserQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.user(id),
    queryFn: () => unwrap(data.admin.user(id)),
    retry: false,
  })

export const adminInvoicesQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.invoices(id),
    queryFn: () => unwrap(data.admin.invoices(id)),
  })

export const adminActionsQuery = (filter: AdminActionFilter) =>
  queryOptions({
    queryKey: adminKeys.actions(filter),
    queryFn: () => unwrap(data.admin.actions(filter)),
    placeholderData: keepPreviousData,
  })
