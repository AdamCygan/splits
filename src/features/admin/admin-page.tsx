import { useDeferredValue, useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field, Select, Switch } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { data } from '#/data'
import type {
  AdminUser,
  AdminUserChange,
  AdminUserFilter,
  PlanCode,
} from '#/data/types'
import { useCurrentUser } from '#/features/auth/session'
import { formatPrice } from '#/features/billing/plans'
import { SectionHeader } from '#/features/settings/components/ui'
import { useDataMutation } from '#/features/settings/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { panelMessages } from '#/i18n/messages/panel'
import { unwrap } from '#/lib/api-client'

const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  users: (filter: AdminUserFilter) => ['admin', 'users', filter] as const,
  actions: ['admin', 'actions'] as const,
}
const PLANS: ReadonlyArray<PlanCode> = ['free', 'pro', 'lifetime']
const planTone = { free: 'muted', pro: 'info', lifetime: 'success' } as const

interface SignupsProps {
  rows: ReadonlyArray<{ day: string; count: number }>
  label: string
  dayLabel: (day: string, count: number) => string
}

/** Rejestracje z 14 dni jako małe słupki; dokładne liczby są w podpisach dla czytników i w title. */
function Signups({ rows, label, dayLabel }: SignupsProps) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000)
    return d.toISOString().slice(0, 10)
  })
  const counts = days.map((day) => rows.find((r) => r.day === day)?.count ?? 0)
  const peak = Math.max(1, ...counts)
  return (
    <figure className="bg-surface px-4 py-3 sm:px-5">
      <figcaption className="text-sm text-ink-soft">{label}</figcaption>
      <ol className="mt-2 flex h-12 items-end gap-1">
        {days.map((day, i) => (
          <li
            key={day}
            title={dayLabel(day, counts[i]!)}
            className="bar-rise flex-1 rounded-sm bg-wt-task"
            style={{
              height: `${Math.max(6, (counts[i]! / peak) * 100)}%`,
              opacity: counts[i] ? 1 : 0.18,
            }}
          >
            <span className="sr-only">{dayLabel(day, counts[i]!)}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}

export function AdminPage() {
  const t = useMessages(panelMessages).admin
  const app = useMessages(appMessages)
  const format = useFormat()
  const { locale, tag } = useI18n()
  const me = useCurrentUser()

  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState<PlanCode | ''>('')
  const [status, setStatus] = useState<AdminUserFilter['status'] | ''>('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const q = useDeferredValue(search).trim()
  // Zmiana filtra wraca na pierwszą stronę.
  useEffect(() => setPage(1), [q, plan, status])

  const filter: AdminUserFilter = {
    ...(q ? { q } : {}),
    ...(plan ? { plan } : {}),
    ...(status ? { status } : {}),
    page,
  }
  const stats = useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => unwrap(data.admin.stats()),
  }).data
  const users = useQuery({
    queryKey: adminKeys.users(filter),
    queryFn: () => unwrap(data.admin.users(filter)),
    placeholderData: keepPreviousData,
  })
  const actions = useQuery({
    queryKey: adminKeys.actions,
    queryFn: () => unwrap(data.admin.actions()),
  })

  const list = users.data?.items ?? []
  const pages = users.data
    ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize))
    : 1
  const open = list.find((u) => u.id === openId) ?? null
  const day = (value: string | null) =>
    value ? formatDate(locale, new Date(value)) : t.never
  const stamp = (value: string) =>
    new Date(value).toLocaleString(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  const tiles: Array<[string, string, string?]> = stats
    ? [
        [t.stats.users, format.number(stats.users, 0)],
        [t.stats.new7, format.number(stats.new7, 0)],
        [t.stats.active7, format.number(stats.active7, 0)],
        [t.stats.paid, format.number(stats.pro + stats.lifetime, 0)],
        [
          t.stats.revenue,
          formatPrice(stats.yearlyRevenue, tag),
          fmt(t.stats.revenueHint, { n: stats.activeSubscriptions }),
        ],
        [t.stats.demo, format.number(stats.demo, 0)],
      ]
    : []

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t.title} lead={t.lead} />

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
        {stats ? (
          <>
            {tiles.map(([label, value, hint]) => (
              <div key={label} className="bg-surface px-4 py-3 sm:px-5">
                <p className="text-sm text-ink-soft">{label}</p>
                <p className="type-heading mt-0.5 text-2xl tabular-nums">
                  {value}
                </p>
                {hint && <p className="text-sm text-ink-soft">{hint}</p>}
              </div>
            ))}
            <div className="col-span-2">
              <Signups
                rows={stats.signups}
                label={t.stats.signups}
                dayLabel={(d, n) =>
                  fmt(t.stats.signupsDay, {
                    date: formatDate(locale, d, {
                      day: 'numeric',
                      month: 'short',
                    }),
                    n,
                  })
                }
              />
            </div>
          </>
        ) : (
          <div
            className="col-span-full h-36 animate-pulse bg-surface"
            aria-hidden
          />
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={t.filters.search}>
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                {...control}
                type="search"
                value={search}
                placeholder={t.filters.searchPlaceholder}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <Field label={t.filters.plan}>
          {(control) => (
            <Select
              {...control}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanCode | '')}
            >
              <option value="">{t.filters.allPlans}</option>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {t.plans[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.filters.status}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminUserFilter['status'] | '')
              }
            >
              <option value="">{t.filters.allStatuses}</option>
              <option value="active">{t.filters.active}</option>
              <option value="blocked">{t.filters.blocked}</option>
              <option value="demo">{t.filters.demo}</option>
            </Select>
          )}
        </Field>
      </div>

      <section
        aria-label={t.title}
        aria-busy={users.isFetching}
        className="overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {users.isPending ? (
          <div role="status" className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-12 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-5 py-8 text-ink-soft sm:px-6">{t.empty}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[46rem] text-[0.9375rem]">
              <thead>
                <tr className="text-left text-sm text-ink-soft">
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                    {t.columns.user}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {t.columns.plan}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {t.columns.joined}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {t.columns.lastLogin}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    {t.columns.entries}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-medium sm:px-6"
                  >
                    <span className="sr-only">{t.columns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="row-hover border-t border-line">
                    <th
                      scope="row"
                      className="max-w-[20rem] px-5 py-3 text-left font-normal sm:px-6"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-semibold">
                          {u.displayName}
                        </span>
                        {u.id === me?.id && (
                          <Badge tone="muted">{t.badges.you}</Badge>
                        )}
                        {u.isOwner ? (
                          <Badge tone="success">{t.badges.owner}</Badge>
                        ) : (
                          u.role === 'admin' && (
                            <Badge tone="info">{t.badges.admin}</Badge>
                          )
                        )}
                        {u.isDemo && (
                          <Badge tone="muted">{t.badges.demo}</Badge>
                        )}
                        {u.disabledAt && (
                          <Badge tone="warning">{t.badges.blocked}</Badge>
                        )}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">
                        {u.email}
                      </span>
                    </th>
                    <td className="px-3 py-3">
                      <Badge tone={planTone[u.plan]}>{t.plans[u.plan]}</Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {day(u.createdAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {day(u.lastLoginAt)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {format.number(u.entries, 0)}
                    </td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={fmt(t.manageLabel, { name: u.displayName })}
                        onClick={() => setOpenId(u.id)}
                      >
                        {t.manage}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {users.data && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
            <p role="status" className="text-ink-soft">
              {format.plural(t.total, users.data.total)}
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t.prev}
                </Button>
                <span className="tabular-nums">
                  {fmt(t.page, { page, pages })}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t.next}
                </Button>
              </div>
            )}
          </footer>
        )}
      </section>

      <section
        aria-labelledby="admin-log"
        className="mt-6 rounded-2xl border border-line bg-surface"
      >
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id="admin-log" className="type-heading text-2xl">
            {t.log.title}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-ink-soft">{t.log.lead}</p>
        </header>
        {(actions.data ?? []).length === 0 ? (
          <p className="px-5 py-6 text-ink-soft sm:px-6">
            {actions.isPending ? '…' : t.log.empty}
          </p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[40rem] text-[0.9375rem]">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-sm text-ink-soft">
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                    {t.log.when}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {t.log.action}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {t.log.target}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                    {t.log.admin}
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.data!.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-5 py-2.5 whitespace-nowrap text-ink-soft sm:px-6">
                      {stamp(a.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      {a.action in t.log.actions
                        ? t.log.actions[a.action as keyof typeof t.log.actions]
                        : a.action}
                      {a.detail && (
                        <span className="text-ink-soft"> ({a.detail})</span>
                      )}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5">
                      {a.targetEmail}
                    </td>
                    <td className="max-w-[16rem] truncate px-5 py-2.5 text-ink-soft sm:px-6">
                      {a.adminEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && (
        <ManageDialog
          key={open.id}
          user={open}
          self={open.id === me?.id}
          day={day}
          onClose={() => setOpenId(null)}
          closeLabel={app.actions.close}
          cancelLabel={app.actions.cancel}
        />
      )}
    </div>
  )
}

interface ManageDialogProps {
  user: AdminUser
  self: boolean
  day: (value: string | null) => string
  onClose: () => void
  closeLabel: string
  cancelLabel: string
}

function ManageDialog({
  user,
  self,
  day,
  onClose,
  closeLabel,
  cancelLabel,
}: ManageDialogProps) {
  const t = useMessages(panelMessages).admin
  const { locale } = useI18n()
  const [plan, setPlan] = useState<PlanCode>(user.plan)
  const [confirming, setConfirming] = useState<'block' | 'delete' | null>(null)
  const name = user.displayName

  const update = useDataMutation(
    (change: AdminUserChange) => data.admin.updateUser(user.id, change),
    {
      invalidate: [adminKeys.all],
      success: (_, change) =>
        change.plan
          ? fmt(t.toast.plan, { plan: t.plans[change.plan] })
          : change.role
            ? fmt(change.role === 'admin' ? t.toast.roleOn : t.toast.roleOff, {
                name,
              })
            : fmt(change.disabled ? t.toast.blocked : t.toast.unblocked, {
                name,
              }),
      onSuccess: () => setConfirming(null),
    },
  )
  const revoke = useDataMutation(() => data.admin.revokeSessions(user.id), {
    invalidate: [adminKeys.actions],
    success: fmt(t.toast.revoked, { name }),
  })
  const remove = useDataMutation(() => data.admin.deleteUser(user.id), {
    invalidate: [adminKeys.all],
    success: fmt(t.toast.deleted, { name }),
    onSuccess: onClose,
  })
  const busy = update.isPending || revoke.isPending || remove.isPending
  // Własne konto i konto właściciela: bez zmiany roli, blokady i usuwania.
  const locked = self || user.isOwner
  const sub = user.subscription

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          title={t.dialog.title}
          description={user.email}
          closeLabel={closeLabel}
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-lg font-semibold">{name}</span>
              {user.isOwner ? (
                <Badge tone="success">{t.badges.owner}</Badge>
              ) : (
                user.role === 'admin' && (
                  <Badge tone="info">{t.badges.admin}</Badge>
                )
              )}
              {user.isDemo && <Badge tone="muted">{t.badges.demo}</Badge>}
              {user.disabledAt && (
                <Badge tone="warning">{t.badges.blocked}</Badge>
              )}
              {!user.hasPassword && !user.isDemo && (
                <Badge tone="muted">{t.badges.google}</Badge>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.9375rem]">
              {[
                [t.dialog.joined, day(user.createdAt)],
                [t.dialog.lastLogin, day(user.lastLoginAt)],
                [t.dialog.entries, String(user.entries)],
                [
                  t.dialog.lastEntry,
                  user.lastEntryOn
                    ? formatDate(locale, user.lastEntryOn)
                    : t.never,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-ink-soft">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
              {sub && (
                <div className="col-span-2">
                  <dt className="text-sm text-ink-soft">
                    {fmt(t.badges.subscription, { status: sub.status })}
                  </dt>
                  <dd className="font-medium">
                    {sub.currentPeriodEnd
                      ? fmt(
                          sub.cancelAtPeriodEnd
                            ? t.badges.ends
                            : t.badges.renews,
                          {
                            date: day(sub.currentPeriodEnd),
                          },
                        )
                      : '–'}
                  </dd>
                </div>
              )}
            </dl>

            {locked && (
              <p className="rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
                {user.isOwner ? t.dialog.owner : t.dialog.self}
              </p>
            )}
            {user.isDemo && (
              <p className="rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
                {t.dialog.demo}
              </p>
            )}

            {!user.isDemo && (
              <div className="border-t border-line pt-5">
                <Field label={t.dialog.plan} hint={t.dialog.planHint}>
                  {(control) => (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select
                          {...control}
                          value={plan}
                          onChange={(e) => setPlan(e.target.value as PlanCode)}
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p}>
                              {t.plans[p]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        className="h-11"
                        disabled={busy || plan === user.plan}
                        onClick={() => update.mutate({ plan })}
                      >
                        {t.dialog.savePlan}
                      </Button>
                    </div>
                  )}
                </Field>
              </div>
            )}

            {!user.isDemo && !locked && (
              <div className="border-t border-line pt-5">
                <Switch
                  label={t.dialog.role}
                  description={t.dialog.roleHint}
                  checked={user.role === 'admin'}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    update.mutate({ role: checked ? 'admin' : 'client' })
                  }
                />
              </div>
            )}

            <div className="space-y-4 border-t border-line pt-5">
              <h3 className="font-semibold">{t.dialog.access}</h3>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[38ch] text-sm text-ink-soft">
                  {t.dialog.revokeHint}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => revoke.mutate(undefined)}
                >
                  {t.dialog.revoke}
                </Button>
              </div>
              {!locked && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[38ch] text-sm text-ink-soft">
                    {user.disabledAt
                      ? fmt(t.dialog.blockedSince, {
                          date: day(user.disabledAt),
                        })
                      : t.dialog.blockHint}
                  </p>
                  {user.disabledAt ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => update.mutate({ disabled: false })}
                    >
                      {t.dialog.unblock}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirming('block')}
                    >
                      {t.dialog.block}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!locked && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <div>
                  <h3 className="font-semibold">{t.dialog.danger}</h3>
                  <p className="max-w-[38ch] text-sm text-ink-soft">
                    {t.dialog.deleteHint}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirming('delete')}
                >
                  {t.dialog.delete}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming === 'block'}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={fmt(t.confirm.blockTitle, { name })}
        description={t.confirm.blockText}
        confirmLabel={t.dialog.block}
        cancelLabel={cancelLabel}
        destructive
        busy={update.isPending}
        onConfirm={() => update.mutate({ disabled: true })}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={fmt(t.confirm.deleteTitle, { name })}
        description={t.confirm.deleteText}
        confirmLabel={t.dialog.delete}
        cancelLabel={cancelLabel}
        destructive
        busy={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  )
}
