import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Badge } from '#/components/ui/controls'
import type { AdminUser } from '#/features/admin/data/dto'
import { isPaymentProblem } from '#/domain/admin'
import type { AdminUserSort } from '#/domain/admin'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { cn } from '#/lib/utils'
import { Pagination } from '../components/pagination'
import type { UsersPageViewModel } from './use-users-page'

export const planTone = {
  free: 'muted',
  pro: 'info',
  lifetime: 'success',
} as const

export interface UsersTableProps {
  vm: UsersPageViewModel
}

/** Lista kont z sortowaniem po kolumnach; nazwa konta prowadzi do jego strony. */
export function UsersTable({ vm }: UsersTableProps) {
  const t = useMessages(adminMessages)
  const format = useFormat()
  return (
    <div
      aria-busy={vm.usersFetching}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      {vm.usersPending ? (
        <div role="status" className="space-y-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-12 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : vm.users.length === 0 ? (
        <p className="px-5 py-8 text-ink-soft sm:px-6">{t.empty}</p>
      ) : (
        <div
          className="relative overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label={t.title}
        >
          <table className="w-full min-w-[52rem] text-[0.9375rem]">
            <thead>
              <tr className="text-left text-sm text-ink-soft">
                <SortHeader
                  vm={vm}
                  column="name"
                  label={t.columns.user}
                  first
                />
                <SortHeader vm={vm} column="plan" label={t.columns.plan} />
                <SortHeader vm={vm} column="created" label={t.columns.joined} />
                <SortHeader
                  vm={vm}
                  column="lastLogin"
                  label={t.columns.lastLogin}
                />
                <SortHeader
                  vm={vm}
                  column="lastActive"
                  label={t.columns.lastActive}
                />
                <SortHeader
                  vm={vm}
                  column="entries"
                  label={t.columns.entries}
                  numeric
                  last
                />
              </tr>
            </thead>
            <tbody>
              {vm.users.map((u) => (
                <UserRow key={u.id} user={u} me={u.id === vm.meId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
        <p role="status" className="text-ink-soft">
          {format.plural(t.total, vm.total)}
        </p>
        <Pagination page={vm.page} pages={vm.pages} onPage={vm.setPage} />
      </footer>
    </div>
  )
}

interface UserRowProps {
  user: AdminUser
  me: boolean
}

function UserRow({ user: u, me }: UserRowProps) {
  const t = useMessages(adminMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const day = (value: string | null) =>
    value ? formatDate(locale, new Date(value)) : t.never
  return (
    <tr className="row-hover border-t border-line">
      <th
        scope="row"
        className="max-w-[22rem] px-5 py-3 text-left font-normal sm:px-6"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/app/admin/users/$id"
            params={{ id: u.id }}
            className="truncate font-semibold underline-offset-4 hover:underline"
          >
            {u.displayName}
          </Link>
          {me && <Badge tone="muted">{t.badges.you}</Badge>}
          {u.isOwner ? (
            <Badge tone="success">{t.badges.owner}</Badge>
          ) : (
            u.role === 'admin' && <Badge tone="info">{t.badges.admin}</Badge>
          )}
          {u.isDemo && <Badge tone="muted">{t.badges.demo}</Badge>}
          {u.disabledAt && <Badge tone="warning">{t.badges.blocked}</Badge>}
          {isPaymentProblem(u.subscription?.status) && (
            <Badge tone="warning">{t.badges.paymentProblem}</Badge>
          )}
          {!u.emailVerified && !u.isDemo && (
            <Badge tone="muted">{t.badges.unverified}</Badge>
          )}
          {u.twoFactor && <Badge tone="muted">{t.badges.twoFactor}</Badge>}
        </span>
        <span className="block truncate text-sm text-ink-soft">{u.email}</span>
      </th>
      <td className="px-3 py-3">
        <Badge tone={planTone[u.plan]}>{t.plans[u.plan]}</Badge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">{day(u.createdAt)}</td>
      <td className="px-3 py-3 whitespace-nowrap">{day(u.lastLoginAt)}</td>
      <td className="px-3 py-3 whitespace-nowrap">{day(u.lastActiveAt)}</td>
      <td className="px-5 py-3 text-right tabular-nums sm:px-6">
        {format.number(u.entries, 0)}
      </td>
    </tr>
  )
}

interface SortHeaderProps {
  vm: UsersPageViewModel
  column: AdminUserSort
  label: string
  numeric?: boolean
  first?: boolean
  last?: boolean
}

/** Nagłówek kolumny z przyciskiem sortowania i aria-sort. */
function SortHeader({
  vm,
  column,
  label,
  numeric,
  first,
  last,
}: SortHeaderProps) {
  const t = useMessages(adminMessages).columns
  const active = vm.sort.sort === column
  const Icon = !active
    ? ArrowUpDown
    : vm.sort.dir === 'asc'
      ? ArrowUp
      : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? vm.sort.dir === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
      className={cn(
        'py-1.5 font-medium whitespace-nowrap',
        first ? 'px-5 sm:px-6' : last ? 'px-5 sm:px-6' : 'px-3',
        numeric && 'text-right',
      )}
    >
      <button
        type="button"
        onClick={() => vm.toggleSort(column)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">, {fmt(t.sortBy, { column: label })}</span>
      </button>
    </th>
  )
}
