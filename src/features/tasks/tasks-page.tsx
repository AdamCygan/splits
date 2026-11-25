import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  Circle,
  CircleCheck,
  ExternalLink,
  MoreHorizontal,
  Play,
  ScrollText,
  Search,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ColorDot, Field, Select } from '#/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import type { TimeEntry } from '#/data/types'
import { addDays, todayIn } from '#/domain/dates'
import { groupTasks, sortRows, taskGroupKey, totalsOf } from '#/domain/report'
import type { TaskRow, TaskSort } from '#/domain/report'
import { groupTaskList, matchesStatus, taskStatus } from '#/domain/task-list'
import type {
  TaskGrouping,
  TaskStatus,
  TaskStatusFilter,
} from '#/domain/task-list'
import { estimateOf, sprintDay } from '#/domain/sprint-stats'
import type { EstimateStatus } from '#/domain/sprint-stats'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import { SectionHeader } from '#/features/settings/components/ui'
import {
  meQuery,
  scaleQuery,
  sprintsQuery,
  settingsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { SummaryDialog } from '#/features/time-entries/components/summary-dialog'
import { useResumeTask } from '#/features/time-entries/components/timer'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'
import { DeleteTaskDialog } from './delete-task-dialog'
import { TaskLink } from './task-link'

const PERIODS = { d30: 30, d90: 90, d365: 365 } as const
type PeriodId = keyof typeof PERIODS
type EstimateFilter = 'all' | EstimateStatus
const PAGE = 30

export function TasksPage({
  sprint: initialSprint,
  onSprintChange,
}: {
  /** Sprint z adresu (?sprint=): od razu pokazuje jego zadania. */
  sprint?: string
  onSprintChange?: (sprintId: string | undefined) => void
} = {}) {
  const t = useMessages(panelMessages).tasks
  const [deletingTask, setDeletingTask] = useState<TaskRow | null>(null)
  const format = useFormat()
  const { locale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const types = useQuery(taskTypesQuery).data ?? []
  const scale = useQuery(scaleQuery).data ?? []
  const today = todayIn(settings?.timezone)
  const isFree = !hasProAccess(user)

  const [periodId, setPeriodId] = useState<PeriodId | `sprint:${string}`>(
    initialSprint ? `sprint:${initialSprint}` : 'd30',
  )
  const allSprints = useQuery(sprintsQuery).data ?? []
  const oldest = isFree ? addDays(today, -(FREE_LIMITS.historyDays - 1)) : null
  // Sprinty, które już się zaczęły (najnowsze pierwsze); w Free tylko te z ostatnich 30 dni.
  const sprintOptions = allSprints
    .filter((s) => s.startsOn <= today && (!oldest || s.endsOn >= oldest))
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
    .slice(0, 26)
  const sprint = periodId.startsWith('sprint:')
    ? allSprints.find((s) => `sprint:${s.id}` === periodId)
    : undefined
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [estimate, setEstimate] = useState<EstimateFilter>('all')
  const [status, setStatus] = useState<TaskStatusFilter>('all')
  const [grouping, setGrouping] = useState<TaskGrouping>('kind')
  const [sort, setSort] = useState<TaskSort>('last')
  const [limit, setLimit] = useState(PAGE)
  const [summarizing, setSummarizing] = useState<TimeEntry | null>(null)
  const query = useDeferredValue(search).trim().toLocaleLowerCase()
  const resume = useResumeTask()

  const days = isFree
    ? FREE_LIMITS.historyDays
    : periodId in PERIODS
      ? PERIODS[periodId as PeriodId]
      : PERIODS.d30
  const from = sprint
    ? oldest && sprint.startsOn < oldest
      ? oldest
      : sprint.startsOn
    : addDays(today, -(days - 1))
  const to = sprint ? (sprint.endsOn < today ? sprint.endsOn : today) : today
  const entries = useQuery(rangeEntriesQuery(from, to))

  const { rows, latest, finished } = useMemo(() => {
    const list = entries.data ?? []
    // Ostatni wpis zadania: z niego startuje „Kontynuuj” i podsumowanie.
    const last = new Map<string, TimeEntry>()
    const done = new Set<string>()
    for (const e of list) {
      last.set(taskGroupKey(e), e)
      if (e.finishedAt) done.add(taskGroupKey(e))
    }
    return {
      rows: sortRows(
        groupTasks(list, types),
        sort,
        sort === 'title' ? 'asc' : 'desc',
      ).map((row) => ({
        row,
        estimate: estimateOf(row, scale),
      })),
      latest: last,
      finished: done,
    }
  }, [entries.data, types, scale, sort])

  const filtered = rows.filter(
    ({ row, estimate: e }) =>
      (!typeId || row.taskTypeId === typeId) &&
      (estimate === 'all' || e?.status === estimate) &&
      matchesStatus(taskStatus(row, finished), status) &&
      (!query ||
        row.title.toLocaleLowerCase().includes(query) ||
        (row.link?.toLocaleLowerCase().includes(query) ?? false) ||
        (row.taskKey?.toLocaleLowerCase().includes(query) ?? false)),
  )
  const totals = totalsOf(filtered.map((x) => x.row))
  const estimated = filtered.filter((x) => x.estimate !== null)
  const over = estimated.filter((x) => x.estimate!.status === 'over').length
  const filtering = Boolean(
    query || typeId || estimate !== 'all' || status !== 'all',
  )
  const visible = filtered.slice(0, limit)
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const usedTypes = types.filter((x) =>
    rows.some((r) => r.row.taskTypeId === x.id),
  )

  const clear = () => {
    setSearch('')
    setTypeId('')
    setEstimate('all')
    setStatus('all')
  }

  const groups = groupTaskList(visible, grouping)
  const longest = Math.max(1, ...visible.map((x) => x.row.minutes))
  const spTotal = filtered.reduce((sum, x) => sum + (x.row.storyPoints ?? 0), 0)
  const doneCount = filtered.filter(
    (x) => taskStatus(x.row, finished) === 'done',
  ).length
  const dayLabel = (date: string) =>
    formatDate(locale, date, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  const groupTitle = (key: string) =>
    grouping === 'kind'
      ? (typeOf(key)?.name ?? '?')
      : grouping === 'day'
        ? formatDate(locale, key, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        : t.title

  const renderRow = ({
    row,
    estimate: e,
  }: {
    row: TaskRow
    estimate: ReturnType<typeof estimateOf>
  }) => {
    const type = typeOf(row.taskTypeId)
    const entry = latest.get(row.key)
    const state = taskStatus(row, finished)
    const showKey =
      row.taskKey &&
      !row.title.toLocaleLowerCase().includes(row.taskKey.toLocaleLowerCase())
    return (
      <li
        key={row.key}
        className="row-hover grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-5 py-4 sm:px-6 lg:grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_8.75rem] lg:items-center lg:gap-x-5"
      >
        <StatusIcon state={state} label={t.state[state]} />
        <div className="min-w-0">
          <p className="min-w-0 break-words">
            <TaskLink
              task={row}
              className={cn(
                'mr-2 font-semibold',
                state === 'done' && 'text-ink-soft',
              )}
            >
              {row.title}
            </TaskLink>
            {showKey && (
              <span className="mr-2 inline-block rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-xs text-ink-soft">
                {row.taskKey}
              </span>
            )}
            {row.link && (
              <a
                href={row.link}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={fmt(t.open, { name: row.title })}
                className="-my-1 inline-flex size-6 items-center justify-center rounded-sm align-middle text-ink-faint hover:text-ink"
              >
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {grouping !== 'kind' && (
              <span className="mr-1.5 inline-flex items-center gap-1.5 align-middle">
                <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
                {type?.name}
                <span aria-hidden>·</span>
              </span>
            )}
            {grouping !== 'day' && (
              <>
                {fmt(t.lastShort, { date: dayLabel(row.last) })}
                <span aria-hidden> · </span>
              </>
            )}
            {fmt(t.meta, {
              sessions: format.plural(t.sessions, row.sessions),
              days: format.plural(t.days, row.days),
            })}
          </p>
        </div>

        {/* Liczby: na wąskim ekranie w jednej linii pod tytułem, na szerokim w kolumnach. */}
        <div className="col-start-2 flex flex-wrap items-center gap-x-5 gap-y-2 lg:contents">
          <p className="text-sm tabular-nums lg:text-right">
            <span className="sr-only">{t.columns.sp}: </span>
            {row.storyPoints === null ? (
              <span className="text-ink-faint">–</span>
            ) : (
              <span className="font-medium">{format.sp(row.storyPoints)}</span>
            )}
          </p>
          <div className="min-w-32 lg:min-w-0">
            <p className="flex items-baseline justify-between gap-2 tabular-nums">
              <span className="sr-only">{t.columns.time}: </span>
              <span className="font-semibold">
                {format.minutes(row.minutes)}
              </span>
              {row.overtimeMinutes > 0 && (
                <span
                  className="text-xs text-ink-soft"
                  title={row.overtimeNotes.join('\n')}
                >
                  {fmt(t.summary.overtime, {
                    time: format.minutes(row.overtimeMinutes),
                  })}
                </span>
              )}
            </p>
            <span
              aria-hidden
              className="mt-1 block h-1.5 rounded-full bg-muted"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(3, (row.minutes / longest) * 100)}%`,
                  background: type?.color ?? 'var(--wt-custom)',
                }}
              />
            </span>
          </div>
          <EstimateCell row={row} estimate={e} />
          {entry && (
            <div className="flex items-center gap-1 max-lg:ml-auto lg:justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={resume.isPending || row.running}
                aria-label={fmt(t.continueLabel, { name: row.title })}
                onClick={() => resume.mutate(entry.id)}
              >
                <Play aria-hidden fill="currentColor" className="size-3.5" />
                {t.continue}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={fmt(t.moreActions, { name: row.title })}
                  >
                    <MoreHorizontal aria-hidden className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setSummarizing(entry)}>
                    <ScrollText aria-hidden />
                    {t.summaryButton}
                  </DropdownMenuItem>
                  {row.link && (
                    <DropdownMenuItem asChild>
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <ExternalLink aria-hidden />
                        {t.openLink}
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive [&_svg]:text-destructive"
                    onSelect={() => setDeletingTask(row)}
                  >
                    <Trash2 aria-hidden />
                    {t.deleteTask}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t.title} lead={t.lead} />

      {sprint && (
        <div className="mb-4 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="type-heading text-xl">{sprint.name}</p>
            <p className="text-sm text-ink-soft tabular-nums">
              {formatDateRange(locale, sprint.startsOn, sprint.endsOn)}
              <span aria-hidden> · </span>
              {sprint.endsOn < today
                ? t.sprintEnded
                : fmt(t.sprintDay, sprintDay(sprint, today))}
            </p>
          </div>
          {sprint.goal && (
            <p className="mt-1 text-[0.9375rem]">{sprint.goal}</p>
          )}
          <span aria-hidden className="mt-3 block h-1 rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-ink"
              style={{
                width: `${(sprintDay(sprint, today).day / sprintDay(sprint, today).total) * 100}%`,
              }}
            />
          </span>
        </div>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Tile
          label={t.tiles.tasks}
          value={String(totals.tasks)}
          hint={fmt(t.tiles.doneOf, { done: doneCount })}
        />
        <Tile
          label={t.tiles.sp}
          value={format.number(spTotal)}
          hint={
            sprint?.capacityStoryPoints
              ? fmt(t.tiles.spOf, {
                  capacity: format.number(sprint.capacityStoryPoints),
                })
              : undefined
          }
        />
        <Tile
          label={t.tiles.time}
          value={format.minutes(totals.minutes)}
          hint={
            totals.minutesPerSp === null
              ? undefined
              : fmt(t.tiles.perSp, {
                  time: format.minutes(totals.minutesPerSp),
                })
          }
        />
        <Tile
          label={t.tiles.over}
          value={estimated.length ? String(over) : '–'}
          hint={
            estimated.length
              ? fmt(t.tiles.overOf, { total: estimated.length })
              : undefined
          }
        />
      </dl>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <Field label={t.search}>
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
                placeholder={t.searchPlaceholder}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setLimit(PAGE)
                }}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <Field label={t.type}>
          {(control) => (
            <Select
              {...control}
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value)
                setLimit(PAGE)
              }}
            >
              <option value="">{t.allTypes}</option>
              {usedTypes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.estimate}>
          {(control) => (
            <Select
              {...control}
              value={estimate}
              onChange={(e) => {
                setEstimate(e.target.value as EstimateFilter)
                setLimit(PAGE)
              }}
            >
              {(['all', 'over', 'within', 'under'] as const).map((id) => (
                <option key={id} value={id}>
                  {t.estimates[id]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.period}>
          {(control) => (
            <Select
              {...control}
              value={isFree && !sprint ? 'd30' : periodId}
              onChange={(e) => {
                const next = e.target.value as typeof periodId
                setPeriodId(next)
                setLimit(PAGE)
                onSprintChange?.(
                  next.startsWith('sprint:') ? next.slice(7) : undefined,
                )
              }}
            >
              <optgroup label={t.periodGroup}>
                {(isFree
                  ? (['d30'] as Array<PeriodId>)
                  : (Object.keys(PERIODS) as Array<PeriodId>)
                ).map((id) => (
                  <option key={id} value={id}>
                    {t.periods[id]}
                  </option>
                ))}
              </optgroup>
              {sprintOptions.length > 0 && (
                <optgroup label={t.sprintGroup}>
                  {sprintOptions.map((s) => (
                    <option key={s.id} value={`sprint:${s.id}`}>
                      {s.endsOn >= today
                        ? fmt(t.currentSprint, { name: s.name })
                        : s.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          )}
        </Field>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          label={t.view.groupBy}
          size="sm"
          value={grouping}
          onChange={setGrouping}
          options={(['kind', 'day', 'none'] as const).map((value) => ({
            value,
            label: t.view.groups[value],
          }))}
        />
        <Segmented
          label={t.view.status}
          size="sm"
          value={status}
          onChange={(v) => {
            setStatus(v)
            setLimit(PAGE)
          }}
          options={(['all', 'open', 'done'] as const).map((value) => ({
            value,
            label: t.view.statuses[value],
          }))}
        />
        <Field label={t.view.sort} className="w-full sm:ml-auto sm:w-auto sm:min-w-44">
          {(control) => (
            <Select
              {...control}
              value={sort}
              onChange={(e) => setSort(e.target.value as TaskSort)}
            >
              {(['last', 'minutes', 'storyPoints', 'title'] as const).map(
                (id) => (
                  <option key={id} value={id}>
                    {t.view.sorts[id]}
                  </option>
                ),
              )}
            </Select>
          )}
        </Field>
      </div>

      {isFree && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {t.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold text-ink underline underline-offset-4"
          >
            {t.upgrade}
          </Link>
        </p>
      )}

      {entries.isPending ? (
        <div
          role="status"
          className="space-y-3 rounded-2xl border border-line bg-surface p-5"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-14 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-8 sm:px-6">
          <p className="text-ink-soft">{filtering ? t.noMatch : t.empty}</p>
          {filtering && (
            <Button variant="outline" className="mt-4" onClick={clear}>
              {t.clear}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p role="status" className="mb-3 text-sm text-ink-soft">
            {format.plural(t.showing, visible.length)}
          </p>
          <div className="space-y-5">
            {groups.map((group) => {
              const type = grouping === 'kind' ? typeOf(group.key) : undefined
              const percent = Math.round(
                (group.minutes / Math.max(1, totals.minutes)) * 100,
              )
              return (
                <section
                  key={group.key}
                  aria-labelledby={`group-${group.key}`}
                  className="overflow-hidden rounded-2xl border border-line bg-surface"
                >
                  <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-muted/40 px-5 py-3 sm:px-6">
                    <h2
                      id={`group-${group.key}`}
                      className="flex items-center gap-2 font-semibold"
                    >
                      {type && <ColorDot color={type.color} />}
                      {groupTitle(group.key)}
                    </h2>
                    <p className="text-sm text-ink-soft tabular-nums">
                      {format.plural(t.group.count, group.items.length)}
                      <span aria-hidden> · </span>
                      {format.minutes(group.minutes)}
                      {grouping !== 'none' && (
                        <>
                          <span aria-hidden> · </span>
                          {fmt(t.group.share, { percent })}
                        </>
                      )}
                    </p>
                  </header>
                  <div
                    aria-hidden
                    className="hidden grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_8.75rem] gap-x-5 border-b border-line px-6 py-2 text-xs font-medium text-ink-soft lg:grid"
                  >
                    <span />
                    <span>{t.columns.task}</span>
                    <span className="text-right">{t.columns.sp}</span>
                    <span>{t.columns.time}</span>
                    <span>{t.columns.estimate}</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-line">
                    {group.items.map(renderRow)}
                  </ul>
                </section>
              )
            })}
          </div>
          {filtered.length > limit && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setLimit((n) => n + PAGE)}
              >
                {fmt(t.more, { n: Math.min(PAGE, filtered.length - limit) })}
              </Button>
            </div>
          )}
        </>
      )}

      <DeleteTaskDialog
        task={deletingTask}
        date={null}
        sessions={deletingTask?.sessions ?? 0}
        minutes={deletingTask?.minutes ?? 0}
        onClose={() => setDeletingTask(null)}
      />
      {summarizing && (
        <SummaryDialog
          entry={summarizing}
          type={typeOf(summarizing.taskTypeId)}
          onClose={() => setSummarizing(null)}
        />
      )}
    </div>
  )
}

/** Wycena słowami z ikoną; szczegóły (przedział SP albo własna estymata) w dymku. */
function EstimateCell({
  row,
  estimate: e,
}: {
  row: TaskRow
  estimate: ReturnType<typeof estimateOf>
}) {
  const t = useMessages(panelMessages).tasks
  const format = useFormat()
  if (!e)
    return (
      <p className="text-sm text-ink-faint">
        <span className="sr-only">{t.columns.estimate}: </span>
        {t.noEstimate}
      </p>
    )
  const detail =
    e.source === 'estimate'
      ? fmt(t.ownEstimate, {
          time: format.minutes(e.max),
          actual: format.minutes(row.minutes),
        })
      : fmt(t.range, {
          sp: format.sp(row.storyPoints ?? 0),
          min: format.minutes(e.min),
          max: format.minutes(e.max),
        })
  const Icon =
    e.status === 'over' ? TriangleAlert : e.status === 'under' ? Zap : Check
  return (
    <p
      title={detail}
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        e.status === 'over'
          ? 'text-[#9a4a00] dark:text-[#f4b26b]'
          : e.status === 'under'
            ? 'text-[#0b6b5b] dark:text-[#6ee7b7]'
            : 'text-ink-soft',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>
        <span className="sr-only">{t.columns.estimate}: </span>
        {e.status === 'over'
          ? fmt(t.overShort, { time: format.minutes(e.overBy) })
          : t.badge[e.status]}
        <span className="sr-only">. {detail}</span>
      </span>
    </p>
  )
}

/** Stan zadania jako ikona z tekstem dla czytników ekranu. */
function StatusIcon({ state, label }: { state: TaskStatus; label: string }) {
  return (
    <span className="mt-0.5 flex size-5 items-center justify-center lg:mt-0">
      {state === 'done' ? (
        <CircleCheck
          aria-hidden
          className="size-5 text-[#0b6b5b] dark:text-[#6ee7b7]"
        />
      ) : state === 'running' ? (
        <span aria-hidden className="relative flex size-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--wt-task)] opacity-60 motion-reduce:hidden" />
          <span className="relative size-3 rounded-full bg-[var(--wt-task)]" />
        </span>
      ) : (
        <Circle aria-hidden className="size-5 text-ink-faint" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-surface px-4 py-3 sm:px-5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-ink-soft">{hint}</dd>}
    </div>
  )
}
