import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Badge } from '#/components/ui/controls'
import type { AdminUser } from '#/features/admin/data/dto'
import { isPaymentProblem } from '#/features/admin/domain/admin'
import type { AdminUserSort } from '#/features/admin/domain/admin'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { cn } from '#/lib/utils'
import { Pagination } from '../pagination'
import type { UsersPageViewModel } from '../../controllers/use-users-page'

export const planTone = {
  free: 'muted',
  pro: 'info',
  lifetime: 'success',
} as const

export interface UsersTableProps {
  viewModel: UsersPageViewModel
}

/** Lista kont z sortowaniem po kolumnach; nazwa konta prowadzi do jego strony. */
export function UsersTable({ viewModel }: UsersTableProps) {
  const messages = useMessages(adminMessages)
  const format = useFormat()
  return (
    <div
      aria-busy={viewModel.usersFetching}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      {viewModel.usersPending ? (
        <div role="status" className="space-y-3 p-5">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              aria-hidden
              className="h-12 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : viewModel.users.length === 0 ? (
        <p className="px-5 py-8 text-ink-soft sm:px-6">{messages.empty}</p>
      ) : (
        <div
          className="relative overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label={messages.title}
        >
          <table className="w-full min-w-[52rem] text-[0.9375rem]">
            <thead>
              <tr className="text-left text-sm text-ink-soft">
                <SortHeader
                  viewModel={viewModel}
                  column="name"
                  label={messages.columns.user}
                  first
                />
                <SortHeader
                  viewModel={viewModel}
                  column="plan"
                  label={messages.columns.plan}
                />
                <SortHeader
                  viewModel={viewModel}
                  column="created"
                  label={messages.columns.joined}
                />
                <SortHeader
                  viewModel={viewModel}
                  column="lastLogin"
                  label={messages.columns.lastLogin}
                />
                <SortHeader
                  viewModel={viewModel}
                  column="lastActive"
                  label={messages.columns.lastActive}
                />
                <SortHeader
                  viewModel={viewModel}
                  column="entries"
                  label={messages.columns.entries}
                  numeric
                  last
                />
              </tr>
            </thead>
            <tbody>
              {viewModel.users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  me={user.id === viewModel.meId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
        <p role="status" className="text-ink-soft">
          {format.plural(messages.total, viewModel.total)}
        </p>
        <Pagination
          page={viewModel.page}
          pages={viewModel.pages}
          onPage={viewModel.setPage}
        />
      </footer>
    </div>
  )
}

interface UserRowProps {
  user: AdminUser
  me: boolean
}

function UserRow({ user, me }: UserRowProps) {
  const messages = useMessages(adminMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const day = (value: string | null) =>
    value ? formatDate(locale, new Date(value)) : messages.never
  return (
    <tr className="row-hover border-t border-line">
      <th
        scope="row"
        className="max-w-[22rem] px-5 py-3 text-left font-normal sm:px-6"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/app/admin/users/$id"
            params={{ id: user.id }}
            className="truncate font-semibold underline-offset-4 hover:underline"
          >
            {user.displayName}
          </Link>
          {me && <Badge tone="muted">{messages.badges.you}</Badge>}
          {user.isOwner ? (
            <Badge tone="success">{messages.badges.owner}</Badge>
          ) : (
            user.role === 'admin' && (
              <Badge tone="info">{messages.badges.admin}</Badge>
            )
          )}
          {user.isDemo && <Badge tone="muted">{messages.badges.demo}</Badge>}
          {user.disabledAt && (
            <Badge tone="warning">{messages.badges.blocked}</Badge>
          )}
          {isPaymentProblem(user.subscription?.status) && (
            <Badge tone="warning">{messages.badges.paymentProblem}</Badge>
          )}
          {!user.emailVerified && !user.isDemo && (
            <Badge tone="muted">{messages.badges.unverified}</Badge>
          )}
          {user.twoFactor && (
            <Badge tone="muted">{messages.badges.twoFactor}</Badge>
          )}
        </span>
        <span className="block truncate text-sm text-ink-soft">
          {user.email}
        </span>
      </th>
      <td className="px-3 py-3">
        <Badge tone={planTone[user.plan]}>{messages.plans[user.plan]}</Badge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">{day(user.createdAt)}</td>
      <td className="px-3 py-3 whitespace-nowrap">{day(user.lastLoginAt)}</td>
      <td className="px-3 py-3 whitespace-nowrap">{day(user.lastActiveAt)}</td>
      <td className="px-5 py-3 text-right tabular-nums sm:px-6">
        {format.number(user.entries, 0)}
      </td>
    </tr>
  )
}

interface SortHeaderProps {
  viewModel: UsersPageViewModel
  column: AdminUserSort
  label: string
  numeric?: boolean
  first?: boolean
  last?: boolean
}

/** Nagłówek kolumny z przyciskiem sortowania i aria-sort. */
function SortHeader({
  viewModel,
  column,
  label,
  numeric,
  first,
  last,
}: SortHeaderProps) {
  const messages = useMessages(adminMessages).columns
  const active = viewModel.sort.sort === column
  const Icon = !active
    ? ArrowUpDown
    : viewModel.sort.dir === 'asc'
      ? ArrowUp
      : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? viewModel.sort.dir === 'asc'
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
        onClick={() => viewModel.toggleSort(column)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">
          , {fmt(messages.sortBy, { column: label })}
        </span>
      </button>
    </th>
  )
}
