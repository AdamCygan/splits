import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminApi } from '../data/api'
import type { AdminUserFilter } from '#/features/admin/data/dto'
import { adminUsersCsv, nextAdminSort } from '#/features/admin/domain/admin'
import type { AdminUserSort } from '#/features/admin/domain/admin'
import { useCurrentUser } from '#/features/auth/data/session'
import { useFormat, useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { downloadFile } from '#/lib/download'
import { useErrorText } from '#/lib/use-error-text'
import { activeUserFilters, pageCount, withoutEmpty } from '../domain/filters'
import { adminStatsQuery, adminUsersQuery } from '../data/queries'
import { useDebouncedFilter } from '#/shared/controllers/use-debounced-filter'

export interface UsersPageOptions {
  /** Filtry z adresu strony (link do listy można komuś wysłać). */
  filter: AdminUserFilter
  onFilter: (next: AdminUserFilter) => void
}

/** Po tylu milisekundach bez pisania wyszukiwanie trafia do adresu i zapytania. */
const SEARCH_DELAY = 300

/**
 * ViewModel listy kont: liczby, filtry i sortowanie w adresie strony, stronicowanie
 * i eksport CSV (z serwera całość z filtrami, CSV składany w przeglądarce).
 */
export function useUsersPageViewModel({ filter, onFilter }: UsersPageOptions) {
  const t = useMessages(adminMessages)
  const format = useFormat()
  const errorText = useErrorText()
  const me = useCurrentUser()
  const [search, setSearch] = useState(filter.q ?? '')
  const [exporting, setExporting] = useState(false)
  const stats = useQuery(adminStatsQuery)
  const users = useQuery(adminUsersQuery(filter))

  // Zmiana filtra (poza stroną) wraca na pierwszą stronę.
  const update = (patch: Partial<AdminUserFilter>) =>
    onFilter(withoutEmpty({ ...filter, ...patch, page: patch.page }))

  const q = search.trim() || undefined
  useDebouncedFilter(
    q === filter.q ? null : () => update({ q }),
    SEARCH_DELAY,
    [search, filter.q],
  )

  const sort = { sort: filter.sort ?? 'created', dir: filter.dir ?? 'desc' }

  return {
    meId: me?.id,
    filter,
    search,
    stats: stats.data,
    statsPending: stats.isPending,
    users: users.data?.items ?? [],
    usersPending: users.isPending,
    usersFetching: users.isFetching,
    total: users.data?.total ?? 0,
    page: filter.page ?? 1,
    pages: users.data ? pageCount(users.data.total, users.data.pageSize) : 1,
    sort,
    activeFilters: activeUserFilters(filter),
    exporting,
    // akcje
    setSearch,
    setFilter: update,
    setPage: (page: number) => update({ page }),
    toggleSort: (column: AdminUserSort) => update(nextAdminSort(sort, column)),
    clearFilters: () => {
      setSearch('')
      onFilter(withoutEmpty({ sort: filter.sort, dir: filter.dir }))
    },
    exportCsv: async () => {
      setExporting(true)
      const result = await adminApi.exportUsers(filter)
      setExporting(false)
      if (!result.ok) {
        toast.error(errorText(result.error))
        return
      }
      downloadFile(
        `timeblame-users-${new Date().toISOString().slice(0, 10)}.csv`,
        ['﻿', adminUsersCsv(result.value)],
        'text/csv;charset=utf-8',
      )
      toast.success(format.plural(t.filters.exported, result.value.length))
    },
  }
}

export type UsersPageViewModel = ReturnType<typeof useUsersPageViewModel>
