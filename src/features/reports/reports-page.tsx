import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '#/components/ui/button'
import { Badge, ColorDot, Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { Sprint, TaskRef, TimeEntry } from '#/data/types'
import { addDays, todayIn } from '#/domain/dates'
import { elapsedSeconds } from '#/domain/entries'
import {
  byType,
  groupTasks,
  isValidRange,
  presetRange,
  reportCsv,
  sortRows,
  totalsOf,
} from '#/domain/report'
import type { PeriodPreset, ReportRange, TaskSort } from '#/domain/report'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import {
  meQuery,
  projectsQuery,
  settingsQuery,
  sprintsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { TaskDialog } from '#/features/time-entries/components/task-dialog'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'

const PRESETS: ReadonlyArray<PeriodPreset> = [
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_30',
]

type Period = `sprint:${string}` | PeriodPreset | 'custom'

/** Ostatnie sprinty, które już się zaczęły (najnowszy pierwszy). */
function startedSprints(sprints: ReadonlyArray<Sprint>, today: string) {
  return [...sprints]
    .filter((s) => s.startsOn <= today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
    .slice(0, 8)
}

/** Działający timer liczymy do teraz, żeby raport nie pokazywał 0 minut. */
const withElapsed = (entries: ReadonlyArray<TimeEntry>, now: number) =>
  entries.map((e) =>
    e.running
      ? {
          ...e,
          durationMinutes: Math.floor(elapsedSeconds(e.startedAt, now) / 60),
        }
      : e,
  )

export function ReportsPage({ initialSprintId }: { initialSprintId?: string }) {
  const t = useMessages(reportsMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const sprints = useQuery(sprintsQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const today = todayIn(settings?.timezone)
  const [editing, setEditing] = useState<TaskRef | null>(null)

  const started = startedSprints(sprints, today)
  // Sprint z linku (strona Sprinty) może być starszy niż 8 ostatnich: dokładamy go do listy.
  const linked = sprints.find((s) => s.id === initialSprintId)
  const recent =
    linked && !started.includes(linked) ? [...started, linked] : started
  const current = recent.find((s) => s.endsOn >= today)
  const [chosen, setChosen] = useState<Period | null>(
    initialSprintId ? `sprint:${initialSprintId}` : null,
  )
  const fallback: Period = current ? `sprint:${current.id}` : 'this_week'
  // Nieznany sprint w adresie (usunięty, cudzy) = zwykły domyślny okres.
  const period: Period =
    chosen?.startsWith('sprint:') &&
    sprints.length > 0 &&
    !sprints.some((s) => `sprint:${s.id}` === chosen)
      ? fallback
      : (chosen ?? fallback)
  const [custom, setCustom] = useState<ReportRange>(() => ({
    from: addDays(today, -13),
    to: today,
  }))
  const [typeId, setTypeId] = useState('')
  const [sort, setSort] = useState<{ by: TaskSort; dir: 'asc' | 'desc' }>({
    by: 'minutes',
    dir: 'desc',
  })

  const sprint = period.startsWith('sprint:')
    ? sprints.find((s) => `sprint:${s.id}` === period)
    : undefined
  const requested: ReportRange = sprint
    ? { from: sprint.startsOn, to: sprint.endsOn }
    : period === 'custom'
      ? custom
      : presetRange(period as PeriodPreset, today, settings?.weekStartsOn ?? 1)
  // Plan Free: historia z ostatnich 30 dni (jak w cenniku).
  const isFree = !hasProAccess(user)
  const oldest = addDays(today, -(FREE_LIMITS.historyDays - 1))
  const clamped = isFree && requested.from < oldest
  const range = clamped ? { ...requested, from: oldest } : requested
  const valid = isValidRange(range)

  const entries = useQuery({
    ...rangeEntriesQuery(range.from, range.to),
    enabled: valid,
  })

  const allRows = useMemo(
    () => groupTasks(withElapsed(entries.data ?? [], Date.now()), types),
    [entries.data, types],
  )
  const rows = typeId ? allRows.filter((r) => r.taskTypeId === typeId) : allRows
  const sorted = sortRows(rows, sort.by, sort.dir)
  const totals = totalsOf(rows)
  const typeRows = byType(
    allRows,
    types.map((x) => x.id),
  )
  const allMinutes = typeRows.reduce((sum, r) => sum + r.minutes, 0)
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const projectOf = (id: string | null) => projects.find((p) => p.id === id)
  const periodLabel = valid ? formatDateRange(locale, range.from, range.to) : ''

  const toggleSort = (by: TaskSort) =>
    setSort((s) =>
      s.by === by
        ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { by, dir: by === 'title' ? 'asc' : 'desc' },
    )

  const exportCsv = () => {
    const csv = reportCsv(sorted, {
      head: t.csvHead,
      typeName: (id) => typeOf(id)?.name ?? '',
      projectName: (id) => projectOf(id)?.name ?? '',
    })
    // BOM: Excel rozpoznaje wtedy UTF-8 i polskie znaki.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `splits-report-${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t.exported)
  }

  const percent = (minutes: number) =>
    allMinutes > 0 ? Math.round((minutes / allMinutes) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="type-display text-4xl sm:text-5xl">{t.pageTitle}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">{t.lead}</p>
      </header>

      <section
        aria-label={t.filters}
        className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
      >
        <Field label={t.period} className="w-full sm:w-72">
          {(a) => (
            <Select
              {...a}
              value={period}
              onChange={(e) => setChosen(e.target.value as Period)}
            >
              {recent.length > 0 && (
                <optgroup label={t.sprintsGroup}>
                  {recent.map((s) => (
                    <option key={s.id} value={`sprint:${s.id}`}>
                      {s.id === current?.id
                        ? fmt(t.currentSprint, { name: s.name })
                        : s.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t.calendarGroup}>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {t.presets[p]}
                  </option>
                ))}
                <option value="custom">{t.presets.custom}</option>
              </optgroup>
            </Select>
          )}
        </Field>

        {period === 'custom' && (
          <>
            <Field
              label={t.from}
              className="w-[calc(50%-0.5rem)] sm:w-44"
              error={isValidRange(custom) ? null : t.rangeError}
            >
              {(a) => (
                <Input
                  {...a}
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) =>
                    setCustom({ ...custom, from: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label={t.to} className="w-[calc(50%-0.5rem)] sm:w-44">
              {(a) => (
                <Input
                  {...a}
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                />
              )}
            </Field>
          </>
        )}

        <Field label={t.type} className="w-full sm:w-60">
          {(a) => (
            <Select
              {...a}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="">{t.allTypes}</option>
              {types
                .filter((x) => !x.archivedAt)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>

        <div className="sm:ml-auto">
          {isFree ? (
            <Link
              to="/app/settings/plan"
              className={buttonVariants({ variant: 'outline' })}
            >
              <Download aria-hidden className="size-4" />
              {t.exportPro}
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={sorted.length === 0}
            >
              <Download aria-hidden className="size-4" />
              {t.exportCsv}
            </Button>
          )}
        </div>
      </section>

      {clamped && (
        <p className="mb-6 rounded-xl border border-line bg-muted/50 px-4 py-3 text-sm">
          {fmt(t.freeLimit, {
            days: FREE_LIMITS.historyDays,
            date: formatDate(locale, oldest, {
              day: 'numeric',
              month: 'long',
            }),
          })}{' '}
          <Link
            to="/app/settings/plan"
            className="font-medium underline underline-offset-4"
          >
            {t.upgrade}
          </Link>
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          {
            label: t.stats.time,
            value: format.minutes(totals.minutes),
            hint:
              totals.overtimeMinutes > 0
                ? fmt(t.stats.overtime, {
                    time: format.minutes(totals.overtimeMinutes),
                  })
                : undefined,
          },
          { label: t.stats.sp, value: format.sp(totals.storyPoints) },
          { label: t.stats.tasks, value: format.number(totals.tasks, 0) },
          {
            label: t.stats.perSp,
            value:
              totals.minutesPerSp === null
                ? t.stats.none
                : format.minutes(totals.minutesPerSp),
            hint: t.stats.perSpHint,
          },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-4 py-3 sm:px-5">
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="type-heading mt-0.5 text-2xl tabular-nums">
              {s.value}
            </dd>
            {s.hint && <dd className="text-xs text-ink-soft">{s.hint}</dd>}
          </div>
        ))}
      </dl>

      {entries.isPending && valid ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-12 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : allRows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{t.empty}</p>
          <Link
            to="/app"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {t.emptyCta}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            aria-labelledby="report-tasks"
            className="order-2 min-w-0 rounded-2xl border border-line bg-surface xl:order-1"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
              <h2 id="report-tasks" className="type-heading text-2xl">
                {t.table.title}
              </h2>
              <p className="text-sm text-ink-soft">{periodLabel}</p>
            </header>
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label={t.table.region}
            >
              <table className="w-full text-left text-sm sm:min-w-[40rem]">
                <caption className="sr-only">
                  {fmt(t.table.caption, { period: periodLabel })}
                </caption>
                <thead className="bg-muted/50 text-ink-soft">
                  <tr>
                    <SortHeader
                      column="title"
                      label={t.table.columns.title}
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={t.table.sortBy}
                      className="pl-5 sm:pl-6"
                    />
                    <th
                      scope="col"
                      className="hidden px-3 py-2.5 font-medium sm:table-cell"
                    >
                      {t.table.columns.type}
                    </th>
                    <SortHeader
                      column="storyPoints"
                      label={t.table.columns.storyPoints}
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={t.table.sortBy}
                      numeric
                    />
                    <SortHeader
                      column="minutes"
                      label={t.table.columns.minutes}
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={t.table.sortBy}
                      numeric
                    />
                    <th
                      scope="col"
                      className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
                    >
                      {t.table.columns.sessions}
                    </th>
                    <SortHeader
                      column="last"
                      label={t.table.columns.last}
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={t.table.sortBy}
                      className="hidden pr-5 sm:table-cell sm:pr-6"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const type = typeOf(r.taskTypeId)
                    const project = projectOf(r.projectId)
                    return (
                      <tr
                        key={r.key}
                        className="border-t border-line align-top"
                      >
                        <th
                          scope="row"
                          className="max-w-[22rem] py-3 pr-3 pl-5 font-medium sm:pl-6"
                        >
                          <button
                            type="button"
                            aria-label={fmt(t.table.edit, { name: r.title })}
                            onClick={() =>
                              setEditing({
                                title: r.title,
                                link: r.link,
                                taskTypeId: r.taskTypeId,
                              })
                            }
                            className="group -mx-1 inline-flex max-w-full items-start gap-1.5 rounded px-1 text-left hover:text-ink hover:underline hover:underline-offset-4"
                          >
                            <span>{r.title}</span>
                            <Pencil
                              aria-hidden
                              className="mt-0.5 size-3.5 shrink-0 text-ink-soft opacity-60 group-hover:opacity-100"
                            />
                          </button>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 font-normal">
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft sm:hidden">
                              <ColorDot
                                color={type?.color ?? 'var(--line)'}
                                className="size-2.5"
                              />
                              {type?.name}
                            </span>
                            {project && (
                              <Badge tone="muted">
                                {project.key ?? project.name}
                              </Badge>
                            )}
                            {r.running && (
                              <Badge tone="success">{t.table.running}</Badge>
                            )}
                            {r.link && (
                              <a
                                href={r.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                              >
                                {r.taskKey ?? new URL(r.link).hostname}
                                <ExternalLink aria-hidden className="size-3" />
                                <span className="sr-only">
                                  {' '}
                                  {fmt(t.table.open, { name: r.title })}
                                </span>
                              </a>
                            )}
                          </span>
                        </th>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <ColorDot color={type?.color ?? 'var(--line)'} />
                            {type?.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                          {r.storyPoints === null ? (
                            <span className="text-ink-soft">
                              {t.table.noSp}
                            </span>
                          ) : (
                            <span className="font-semibold">
                              {format.number(r.storyPoints)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                          {format.minutes(r.minutes)}
                          {r.overtimeMinutes > 0 && (
                            <span
                              className="block text-xs font-medium text-ink-soft"
                              title={r.overtimeNotes.join('\n')}
                            >
                              {fmt(t.stats.overtime, {
                                time: format.minutes(r.overtimeMinutes),
                              })}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                          {r.sessions}
                        </td>
                        <td className="hidden py-3 pr-5 pl-3 whitespace-nowrap text-ink-soft sm:table-cell sm:pr-6">
                          {formatDate(locale, r.last, {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <th scope="row" className="py-3 pr-3 pl-5 sm:pl-6">
                      {t.table.total}
                    </th>
                    <td className="hidden px-3 py-3 font-normal text-ink-soft sm:table-cell">
                      {format.plural(t.byType.tasks, totals.tasks)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {format.number(totals.storyPoints)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {format.minutes(totals.minutes)}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                      {rows.reduce((sum, r) => sum + r.sessions, 0)}
                    </td>
                    <td className="hidden pr-5 sm:table-cell sm:pr-6" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section
            aria-labelledby="report-types"
            className="order-1 rounded-2xl border border-line bg-surface p-5 xl:order-2"
          >
            <h2 id="report-types" className="type-heading text-2xl">
              {t.byType.title}
            </h2>
            <div
              role="img"
              aria-label={fmt(t.byType.chart, {
                list: typeRows
                  .map(
                    (r) =>
                      `${typeOf(r.taskTypeId)?.name ?? ''} ${percent(r.minutes)}%`,
                  )
                  .join(', '),
              })}
              className="mt-4 flex h-3 gap-[3px] overflow-hidden rounded-full"
            >
              {typeRows.map((r) => (
                <div
                  key={r.taskTypeId}
                  style={{
                    flexGrow: r.minutes,
                    background: typeOf(r.taskTypeId)?.color,
                  }}
                />
              ))}
            </div>
            <ul className="mt-4 divide-y divide-line">
              {typeRows.map((r) => {
                const type = typeOf(r.taskTypeId)
                return (
                  <li key={r.taskTypeId} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <button
                        type="button"
                        aria-pressed={typeId === r.taskTypeId}
                        onClick={() =>
                          setTypeId((v) =>
                            v === r.taskTypeId ? '' : r.taskTypeId,
                          )
                        }
                        className="inline-flex min-h-6 items-center gap-2 rounded text-left font-medium underline-offset-4 hover:underline aria-pressed:underline"
                      >
                        <ColorDot color={type?.color ?? 'var(--line)'} />
                        {type?.name}
                      </button>
                      <span className="font-semibold tabular-nums">
                        {format.minutes(r.minutes)}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-5 text-sm text-ink-soft">
                      {fmt(t.byType.share, { pct: percent(r.minutes) })} ·{' '}
                      {r.withoutSp === r.tasks
                        ? t.table.noSp
                        : format.sp(r.storyPoints)}{' '}
                      · {format.plural(t.byType.tasks, r.tasks)}
                      {r.withoutSp > 0 && r.withoutSp < r.tasks && (
                        <> ({format.plural(t.byType.withoutSp, r.withoutSp)})</>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
      {editing && (
        <TaskDialog task={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function SortHeader({
  column,
  label,
  sort,
  onSort,
  sortLabel,
  numeric = false,
  className,
}: {
  column: TaskSort
  label: string
  sort: { by: TaskSort; dir: 'asc' | 'desc' }
  onSort: (column: TaskSort) => void
  sortLabel: string
  numeric?: boolean
  className?: string
}) {
  const active = sort.by === column
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
      }
      className={cn(
        'px-3 py-1.5 font-medium whitespace-nowrap',
        numeric && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">, {fmt(sortLabel, { column: label })}</span>
      </button>
    </th>
  )
}
