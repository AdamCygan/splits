import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Settings2 } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { ColorDot } from '#/components/ui/controls'
import { DAY_OFF_KINDS } from '#/data/types'
import type { TaskType } from '#/data/types'
import { sprintAvailability } from '#/domain/days-off'
import { addDays, todayIn } from '#/domain/dates'
import type { TypeRow } from '#/domain/report'
import {
  averageMinutesPerSp,
  sprintDay,
  sprintStats,
  timeGoalProgress,
} from '#/domain/sprint-stats'
import type { GoalProgress, SprintStats } from '#/domain/sprint-stats'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import {
  daysOffQuery,
  meQuery,
  settingsQuery,
  sprintsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { SectionHeader } from '#/features/settings/components/ui'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { reportsMessages } from '#/i18n/messages/reports'
import { ColumnChart } from '#/features/reports/charts'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'

/** Ile zakończonych sprintów porównujemy (plus bieżący). */
const HISTORY = 6

/** Pasek „na co poszedł czas”: segmenty w kolorach typów pracy, z listą pod spodem dla czytników. */
function TypeBar({
  rows,
  types,
  className,
}: {
  rows: ReadonlyArray<TypeRow>
  types: ReadonlyArray<TaskType>
  className?: string
}) {
  const total = rows.reduce((sum, r) => sum + r.minutes, 0)
  if (total === 0)
    return (
      <div aria-hidden className={cn('rounded-full bg-muted', className)} />
    )
  return (
    <div
      aria-hidden
      className={cn('flex gap-0.5 overflow-hidden rounded-full', className)}
    >
      {rows.map((r) => (
        <span
          key={r.taskTypeId}
          className="bar-grow h-full min-w-1"
          style={{
            width: `${(r.minutes / total) * 100}%`,
            background:
              types.find((x) => x.id === r.taskTypeId)?.color ??
              'var(--wt-custom)',
          }}
        />
      ))}
    </div>
  )
}

function Tile({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('bg-surface px-4 py-3 sm:px-5', className)}>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-sm text-ink-soft">{hint}</dd>}
    </div>
  )
}

export function SprintsPage() {
  const t = useMessages(panelMessages).sprints
  const off = useMessages(daysOffMessages)
  const charts = useMessages(reportsMessages).charts
  const tasks = useMessages(panelMessages).tasks
  const format = useFormat()
  const { locale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const sprints = useQuery(sprintsQuery)
  const types = useQuery(taskTypesQuery).data ?? []
  const today = todayIn(settings?.timezone)

  const { current, past, upcoming } = useMemo(() => {
    const all = sprints.data ?? []
    const started = all
      .filter((s) => s.startsOn <= today)
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
    return {
      current: started.find((s) => s.endsOn >= today),
      past: started.filter((s) => s.endsOn < today).slice(0, HISTORY),
      upcoming: all
        .filter((s) => s.startsOn > today)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0],
    }
  }, [sprints.data, today])

  const shown = current ? [current, ...past] : past
  const from = shown.length ? shown.at(-1)!.startsOn : today
  const entries = useQuery({
    ...rangeEntriesQuery(from, today),
    enabled: shown.length > 0,
  })
  const stats = useMemo(
    () => shown.map((s) => sprintStats(s, entries.data ?? [], types)),
    // shown zależy od current i past, a te od danych sprintów i dnia.
    [current, past, entries.data, types],
  )
  const currentStats = current ? stats[0] : undefined
  const pastStats = current ? stats.slice(1) : stats
  const average = averageMinutesPerSp(pastStats.length ? pastStats : stats)
  const averaged = (pastStats.length ? pastStats : stats).filter(
    (s) => s.minutesPerSp !== null,
  ).length
  const lastDay = [current, ...past, upcoming]
    .filter((x) => x !== undefined)
    .reduce((max, x) => (x.endsOn > max ? x.endsOn : max), today)
  const daysOff =
    useQuery({
      ...daysOffQuery(from, lastDay),
      enabled: shown.length > 0,
    }).data ?? []
  const availability = (sprint: { startsOn: string; endsOn: string }) =>
    sprintAvailability(
      sprint,
      settings?.workingDays ?? [1, 2, 3, 4, 5],
      daysOff,
    )
  const offSummary = (byKind: ReturnType<typeof availability>['byKind']) =>
    DAY_OFF_KINDS.filter((k) => byKind[k])
      .map((k) => `${off.kinds[k]} ${byKind[k]}`)
      .join(', ')
  const isFree = !hasProAccess(user)
  const clamped =
    isFree && from < addDays(today, -(FREE_LIMITS.historyDays - 1))
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const perSp = (s: SprintStats) =>
    s.minutesPerSp === null ? '–' : format.minutes(s.minutesPerSp)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader title={t.title} lead={t.lead} />
        <Link
          to="/app/settings/sprints"
          className={buttonVariants({ variant: 'outline' })}
        >
          <Settings2 aria-hidden />
          {t.manage}
        </Link>
      </div>

      {clamped && (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {t.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold underline underline-offset-4"
          >
            {t.upgrade}
          </Link>
        </p>
      )}

      {/* BIEŻĄCY SPRINT */}
      <section
        aria-labelledby="current-sprint"
        className="rounded-2xl border border-line bg-surface"
      >
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-ink-soft">{t.current}</p>
            <h2 id="current-sprint" className="type-heading text-2xl">
              {current ? current.name : t.noCurrent}
            </h2>
          </div>
          {current && (
            <p className="text-sm text-ink-soft">
              {formatDateRange(locale, current.startsOn, current.endsOn)}
            </p>
          )}
        </header>

        {current && currentStats ? (
          <div className="px-5 py-5 sm:px-6">
            {(() => {
              const { day, total } = sprintDay(current, today)
              return (
                <div className="mb-5">
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">
                      {fmt(t.dayOf, { day, total })}
                    </span>
                    {current.goal && (
                      <span className="max-w-[60%] truncate text-ink-soft">
                        {t.goal}: {current.goal}
                      </span>
                    )}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={fmt(t.dayOf, { day, total })}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={day}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="bar-grow h-full rounded-full bg-[var(--ink-fixed)] dark:bg-ink"
                      style={{ width: `${(day / total) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })()}

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-5">
              <Tile
                label={t.logged}
                value={format.minutes(currentStats.minutes)}
                hint={
                  currentStats.overtimeMinutes > 0
                    ? fmt(tasks.summary.overtime, {
                        time: format.minutes(currentStats.overtimeMinutes),
                      })
                    : undefined
                }
              />
              <Tile
                label={t.points}
                value={
                  current.capacityStoryPoints
                    ? fmt(t.ofCapacity, {
                        done: format.number(currentStats.storyPoints),
                        capacity: format.number(current.capacityStoryPoints),
                      })
                    : format.sp(currentStats.storyPoints)
                }
              />
              <Tile
                label={t.perSp}
                value={perSp(currentStats)}
                hint={currentStats.minutesPerSp === null ? t.noSp : undefined}
              />
              <Tile label={t.tasks} value={String(currentStats.tasks)} />
              {(() => {
                const a = availability(current)
                return (
                  <Tile
                    className="col-span-2 lg:col-span-1"
                    label={off.sprint.available}
                    value={fmt(off.sprint.availableValue, {
                      available: a.available,
                      working: a.working,
                    })}
                    hint={
                      a.off === 0
                        ? off.sprint.none
                        : format
                            .plural(off.sprint.off, a.off)
                            .replace('{kinds}', offSummary(a.byKind))
                    }
                  />
                )
              })()}
            </dl>

            {current.timeGoals.length > 0 && (
              <TimeGoals
                progress={timeGoalProgress(
                  current.timeGoals,
                  currentStats.types,
                  sprintDay(current, today).day,
                  sprintDay(current, today).total,
                )}
                types={types}
              />
            )}

            {currentStats.minutes === 0 ? (
              <p className="mt-5 text-ink-soft">
                {entries.isPending ? '…' : t.empty}
              </p>
            ) : (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold">{t.breakdown}</h3>
                <TypeBar
                  rows={currentStats.types}
                  types={types}
                  className="h-4"
                />
                <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentStats.types.map((r) => (
                    <li
                      key={r.taskTypeId}
                      className="flex items-center gap-2.5 text-[0.9375rem]"
                    >
                      <ColorDot
                        color={
                          typeOf(r.taskTypeId)?.color ?? 'var(--wt-custom)'
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {typeOf(r.taskTypeId)?.name ?? '?'}
                      </span>
                      <span className="tabular-nums">
                        {format.minutes(r.minutes)}
                      </span>
                      <span className="w-11 text-right text-ink-soft tabular-nums">
                        {Math.round((r.minutes / currentStats.minutes) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm text-ink-soft">
                {upcoming &&
                  fmt(t.upcoming, {
                    name: upcoming.name,
                    date: formatDate(locale, upcoming.startsOn, {
                      day: 'numeric',
                      month: 'short',
                    }),
                  })}
              </p>
              <span className="flex flex-wrap gap-2">
                <Link
                  to="/app/tasks"
                  search={{ sprint: current.id }}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t.openTasks}
                </Link>
                <Link
                  to="/app/analytics"
                  search={{ sprint: current.id }}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t.openReport}
                  <ArrowRight aria-hidden />
                </Link>
              </span>
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 sm:px-6">
            {sprints.isPending ? (
              <div
                aria-hidden
                className="h-24 animate-pulse rounded-lg bg-muted"
              />
            ) : (
              <Link
                to="/app/settings/sprints"
                className={buttonVariants({ variant: 'default' })}
              >
                {t.noCurrentCta}
              </Link>
            )}
          </div>
        )}
      </section>

      {/* TREND: SP i godziny na SP sprint po sprincie (dwie skale, więc dwa wykresy) */}
      {stats.length >= 2 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ColumnChart
            title={charts.sprints.sp}
            lead={charts.sprints.spLead}
            items={[...stats].reverse().map((x) => ({
              key: x.sprint.id,
              label: x.sprint.name,
              value: x.storyPoints,
              display: format.number(x.storyPoints),
            }))}
          />
          <ColumnChart
            title={charts.sprints.perSp}
            lead={charts.sprints.perSpLead}
            color="var(--wt-pair)"
            items={[...stats].reverse().map((x) => ({
              key: x.sprint.id,
              label: x.sprint.name,
              value: x.minutesPerSp ?? 0,
              display:
                x.minutesPerSp === null ? '–' : format.minutes(x.minutesPerSp),
            }))}
          />
        </div>
      )}

      {/* HISTORIA */}
      <section
        aria-labelledby="sprint-history"
        className="mt-6 rounded-2xl border border-line bg-surface"
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="max-w-[60ch]">
            <h2 id="sprint-history" className="type-heading text-2xl">
              {t.history}
            </h2>
            <p className="mt-1 text-[0.9375rem] text-ink-soft">
              {t.historyLead}
            </p>
          </div>
          {average !== null && averaged > 0 && (
            <div className="text-right">
              <p className="text-sm text-ink-soft">
                {fmt(t.average, { n: averaged })}
              </p>
              <p className="type-heading text-2xl tabular-nums">
                {format.minutes(average)}
                <span className="text-base font-normal text-ink-soft">
                  {' '}
                  / SP
                </span>
              </p>
              <p className="text-sm text-ink-soft">
                {fmt(t.averageHint, { time: format.minutes(average * 5) })}
              </p>
            </div>
          )}
        </header>

        {pastStats.length === 0 ? (
          <p className="px-5 py-6 text-ink-soft sm:px-6">{t.emptyHistory}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[0.9375rem]">
              <thead>
                <tr className="text-left text-sm text-ink-soft">
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                    {t.columns.sprint}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    {t.columns.hours}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    {t.columns.points}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    {t.columns.perSp}
                  </th>
                  <th
                    scope="col"
                    className="w-[32%] px-5 py-3 font-medium sm:px-6"
                  >
                    {t.columns.split}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastStats.map((s) => (
                  <tr key={s.sprint.id} className="border-t border-line">
                    <th
                      scope="row"
                      className="px-5 py-3 text-left font-normal sm:px-6"
                    >
                      <Link
                        to="/app/analytics"
                        search={{ sprint: s.sprint.id }}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {s.sprint.name}
                      </Link>
                      <span className="block text-sm text-ink-soft">
                        {formatDateRange(
                          locale,
                          s.sprint.startsOn,
                          s.sprint.endsOn,
                        )}
                        {(() => {
                          const a = availability(s.sprint)
                          return a.off > 0
                            ? `, ${format.plural(off.sprint.short, a.off)}`
                            : ''
                        })()}
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {format.minutes(s.minutes)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {format.number(s.storyPoints)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {perSp(s)}
                    </td>
                    <td className="px-5 py-3 sm:px-6">
                      <TypeBar rows={s.types} types={types} className="h-2.5" />
                      <span className="sr-only">
                        {s.types
                          .map(
                            (r) =>
                              `${typeOf(r.taskTypeId)?.name ?? '?'} ${format.minutes(r.minutes)}`,
                          )
                          .join(', ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Cele czasowe bieżącego sprintu: pasek postępu na rodzaj pracy, ile zostało
 * i czy tempo się zgadza (cel rozłożony równo na dni sprintu).
 */
function TimeGoals({
  progress,
  types,
}: {
  progress: Array<GoalProgress>
  types: ReadonlyArray<TaskType>
}) {
  const t = useMessages(panelMessages).sprints.timeGoals
  const format = useFormat()
  return (
    <section aria-labelledby="sprint-time-goals" className="mt-6">
      <h3 id="sprint-time-goals" className="mb-3 font-semibold">
        {t.title}
      </h3>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {progress.map((g) => {
          const type = types.find((x) => x.id === g.taskTypeId)
          const name = type?.name ?? '?'
          const percent = Math.min(100, Math.round((g.minutes / g.goal) * 100))
          return (
            <li key={g.taskTypeId}>
              <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                <span className="flex min-w-0 items-center gap-2">
                  <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
                  <span className="truncate font-medium">{name}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {fmt(t.of, {
                    done: format.minutes(g.minutes),
                    goal: format.minutes(g.goal),
                  })}
                </span>
              </p>
              <div
                role="progressbar"
                aria-label={fmt(t.label, { name })}
                aria-valuemin={0}
                aria-valuemax={g.goal}
                aria-valuenow={Math.min(g.minutes, g.goal)}
                aria-valuetext={fmt(t.of, {
                  done: format.minutes(g.minutes),
                  goal: format.minutes(g.goal),
                })}
                className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="bar-grow h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: type?.color ?? 'var(--wt-custom)',
                  }}
                />
                {/* Gdzie powinno być przy równym tempie. */}
                {g.status !== 'done' && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-ink"
                    style={{
                      left: `${Math.min(100, (g.expected / g.goal) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {g.status === 'done'
                  ? g.minutes > g.goal
                    ? fmt(t.over, { time: format.minutes(g.minutes - g.goal) })
                    : t.done
                  : `${fmt(t.left, { time: format.minutes(g.left) })}; ${
                      g.status === 'onTrack'
                        ? t.onTrack
                        : fmt(t.behind, {
                            time: format.minutes(g.expected - g.minutes),
                          })
                    }`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">{t.paceHint}</p>
    </section>
  )
}
