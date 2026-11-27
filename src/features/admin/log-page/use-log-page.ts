import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AdminActionFilter } from '#/features/admin/data/dto'
import { pageCount, withoutEmpty } from '../model'
import { adminActionsQuery } from '../queries'

export interface LogPageOptions {
  /** Filtry z adresu strony. */
  filter: AdminActionFilter
  onFilter: (next: AdminActionFilter) => void
}

const TYPE_DELAY = 300

/** ViewModel dziennika zmian: filtry (admin, konto, działanie) w adresie i stronicowanie. */
export function useLogPageViewModel({ filter, onFilter }: LogPageOptions) {
  const actions = useQuery(adminActionsQuery(filter))
  const [admin, setAdmin] = useState(filter.admin ?? '')
  const [target, setTarget] = useState(filter.target ?? '')
  const update = (patch: Partial<AdminActionFilter>) =>
    onFilter(withoutEmpty({ ...filter, ...patch, page: patch.page }))

  // Pola tekstowe trafiają do adresu chwilę po ostatnim wciśnięciu klawisza.
  useEffect(() => {
    const next = {
      admin: admin.trim() || undefined,
      target: target.trim() || undefined,
    }
    if (next.admin === filter.admin && next.target === filter.target) return
    const timer = setTimeout(() => update(next), TYPE_DELAY)
    return () => clearTimeout(timer)
  }, [admin, target, filter.admin, filter.target])

  return {
    filter,
    admin,
    target,
    items: actions.data?.items ?? [],
    pending: actions.isPending,
    total: actions.data?.total ?? 0,
    page: filter.page ?? 1,
    pages: actions.data
      ? pageCount(actions.data.total, actions.data.pageSize)
      : 1,
    setAdmin,
    setTarget,
    setAction: (action: AdminActionFilter['action']) => update({ action }),
    setPage: (page: number) => update({ page }),
  }
}

export type LogPageViewModel = ReturnType<typeof useLogPageViewModel>
