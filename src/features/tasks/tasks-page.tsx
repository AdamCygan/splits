import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Play, ScrollText, Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, ColorDot, Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { TimeEntry } from '#/data/types'
import { addDays, todayIn } from '#/domain/dates'
import { groupTasks, sortRows, taskGroupKey, totalsOf } from '#/domain/report'
import type { TaskRow } from '#/domain/report'
import { estimateOf } from '#/domain/sprint-stats'
import type { EstimateStatus } from '#/domain/sprint-stats'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import { SectionHeader } from '#/features/settings/components/ui'
import {
  meQuery,
  scaleQuery,
  settingsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { SummaryDialog } from '#/features/time-entries/components/summary-dialog'
import { useResumeTask } from '#/features/time-entries/components/timer'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { TaskLink } from './task-link'

const PERIODS = { d30: 30, d90: 90, d365: 365 } as const
type PeriodId = keyof typeof PERIODS
type EstimateFilter = 'all' | EstimateStatus
const PAGE = 30

const badgeTone = {
  over: 'warning',
  within: 'neutral',
  under: 'success',
} as const

export function TasksPage() {
  const t = useMessages(panelMessages).tasks
  const format = useFormat()
  const { locale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const types = useQuery(taskTypesQuery).data ?? []
  const scale = useQuery(scaleQuery).data ?? []
  const today = todayIn(settings?.timezone)
  const isFree = !hasProAccess(user)

  const [periodId, setPeriodId] = useState<PeriodId>('d30')
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [estimate, setEstimate] = useState<EstimateFilter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [summarizing, setSummarizing] = useState<TimeEntry | null>(null)
  const query = useDeferredValue(search).trim().toLocaleLowerCase()
  const resume = useResumeTask()

  const days = isFree ? FREE_LIMITS.historyDays : PERIODS[periodId]
  const entries = useQuery(
    rangeEntriesQuery(addDays(today, -(days - 1)), today),
  )

  const { rows, latest } = useMemo(() => {
    const list = entries.data ?? []
    // Ostatni wpis zadania: z niego startuje „Kontynuuj” i podsumowanie.
    const last = new Map<string, TimeEntry>()
    for (const e of list) last.set(taskGroupKey(e), e)
    return {
      rows: sortRows(groupTasks(list, types), 'last', 'desc').map((row) => ({
        row,
        estimate: estimateOf(row, scale),
      })),
      latest: last,
    }
  }, [entries.data, types, scale])

  const filtered = rows.filter(
    ({ row, estimate: e }) =>
      (!typeId || row.taskTypeId === typeId) &&
      (estimate === 'all' || e?.status === estimate) &&
      (!query ||
        row.title.toLocaleLowerCase().includes(query) ||
        (row.link?.toLocaleLowerCase().includes(query) ?? false) ||
        (row.taskKey?.toLocaleLowerCase().includes(query) ?? false)),
  )
  const totals = totalsOf(filtered.map((x) => x.row))
  const estimated = filtered.filter((x) => x.estimate !== null)
  const over = estimated.filter((x) => x.estimate!.status === 'over').length
  const filtering = Boolean(query || typeId || estimate !== 'all')
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const usedTypes = types.filter((x) =>
    rows.some((r) => r.row.taskTypeId === x.id),
  )

  const clear = () => {
    setSearch('')
    setTypeId('')
    setEstimate('all')
  }

  const renderRow = ({
    row,
    estimate: e,
  }: {
    row: TaskRow
    estimate: ReturnType<typeof estimateOf>
  }) => {
    const type = typeOf(row.taskTypeId)
    const entry = latest.get(row.key)
    return (
      <li
        key={row.key}
        className="row-hover flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:px-6 lg:flex-row lg:items-center lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
            {type?.name ?? '?'}
            {row.taskKey && (
              <span className="font-medium">· {row.taskKey}</span>
            )}
            {row.running && <Badge tone="info">{t.running}</Badge>}
          </p>
          <p className="mt-0.5 flex items-center gap-2 font-semibold">
            <TaskLink task={row} className="truncate">
              {row.title}
            </TaskLink>
            {row.link && (
              <a
                href={row.link}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={fmt(t.open, { name: row.title })}
                className="shrink-0 rounded-sm text-ink-soft hover:text-ink"
              >
                <ExternalLink aria-hidden className="size-4" />
              </a>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {format.plural(t.sessions, row.sessions)} ·{' '}
            {format.plural(t.days, row.days)} ·{' '}
            {fmt(t.last, {
              date: formatDate(locale, row.last, {
                day: 'numeric',
                month: 'short',
              }),
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
          {e && (
            <Badge
              tone={badgeTone[e.status]}
              className="order-last lg:order-none"
            >
              <span
                title={
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
                }
              >
                {e.status === 'over'
                  ? fmt(t.badge.over, { time: format.minutes(e.overBy) })
                  : t.badge[e.status]}
              </span>
            </Badge>
          )}
          <span className="w-14 text-right text-ink-soft tabular-nums">
            {row.storyPoints === null ? '–' : format.sp(row.storyPoints)}
          </span>
          <span className="type-heading w-24 text-right text-lg tabular-nums">
            {format.minutes(row.minutes)}
            {row.overtimeMinutes > 0 && (
              <span
                className="block font-sans text-xs font-medium text-ink-soft"
                title={row.overtimeNotes.join('\n')}
              >
                {fmt(t.summary.overtime, {
                  time: format.minutes(row.overtimeMinutes),
                })}
              </span>
            )}
          </span>
          {entry && (
            <span className="flex gap-1.5">
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
              <Button
                size="sm"
                variant="ghost"
                aria-label={fmt(t.summaryLabel, { name: row.title })}
                onClick={() => setSummarizing(entry)}
              >
                <ScrollText aria-hidden />
                <span className="hidden xl:inline">{t.summaryButton}</span>
              </Button>
            </span>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t.title} lead={t.lead} />

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          [t.summary.tasks, String(totals.tasks)],
          [t.summary.time, format.minutes(totals.minutes)],
          [
            t.summary.over,
            estimated.length
              ? fmt(t.summary.overOf, { n: over, total: estimated.length })
              : '–',
          ],
          [
            t.summary.perSp,
            totals.minutesPerSp === null
              ? '–'
              : format.minutes(totals.minutesPerSp),
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-3 sm:px-5">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
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
              value={isFree ? 'd30' : periodId}
              disabled={isFree}
              onChange={(e) => {
                setPeriodId(e.target.value as PeriodId)
                setLimit(PAGE)
              }}
            >
              {(Object.keys(PERIODS) as Array<PeriodId>).map((id) => (
                <option key={id} value={id}>
                  {t.periods[id]}
                </option>
              ))}
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

      <section
        aria-label={t.title}
        className="overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {entries.isPending ? (
          <div role="status" className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 sm:px-6">
            <p className="text-ink-soft">{filtering ? t.noMatch : t.empty}</p>
            {filtering && (
              <Button variant="outline" className="mt-4" onClick={clear}>
                {t.clear}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p
              role="status"
              className="border-b border-line px-5 py-2.5 text-sm text-ink-soft sm:px-6"
            >
              {format.plural(t.showing, filtered.length)}
            </p>
            <ul>{filtered.slice(0, limit).map(renderRow)}</ul>
            {filtered.length > limit && (
              <div className="border-t border-line p-4 text-center">
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
      </section>

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
