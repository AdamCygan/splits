import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ClipboardCopy, ExternalLink, Play } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, ColorDot } from '#/components/ui/controls'
import { data } from '#/data'
import type { TaskRef, TaskType, TimeEntry } from '#/data/types'
import { toMinutes } from '#/domain/entries'
import { maxPoints } from '#/domain/summary'
import { taskInsights } from '#/domain/task-insights'
import type { TaskInsights } from '#/domain/task-insights'
import { projectsQuery, taskTypesQuery } from '#/features/settings/queries'
import { SummaryDialog } from '#/features/time-entries/components/summary-dialog'
import {
  Sessions,
  TaskDetails,
  taskQueryKey,
} from '#/features/time-entries/components/task-dialog'
import {
  clockTime,
  useResumeTask,
} from '#/features/time-entries/components/timer'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { unwrap } from '#/lib/api-client'
import { cn } from '#/lib/utils'

/**
 * Strona jednego zadania: ile zajęło, w ilu sesjach i dniach, jak często coś odrywało od niego
 * pracę i co to było, notatki, a pod spodem edycja zadania i jego sesji.
 */
export function TaskPage({
  task,
  onRename,
}: {
  task: TaskRef
  /** Po zmianie tytułu albo linku zadanie ma nowy adres strony. */
  onRename: (ref: TaskRef) => void
}) {
  const t = useMessages(taskViewMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const type = types.find((x) => x.id === task.taskTypeId)
  const sessions = useQuery({
    queryKey: taskQueryKey(task),
    queryFn: () => unwrap(data.entries.forTask(task)),
  })
  const list = sessions.data ?? []
  const first = list[0]?.workDate
  const last = list.at(-1)?.workDate
  const sameDays = useQuery({
    ...rangeEntriesQuery(first ?? '', last ?? ''),
    enabled: !!first && !!last,
  }).data
  const insights = taskInsights(list, sameDays ?? list)
  const latest = list.at(-1)
  const project = projects.find((p) => p.id === latest?.projectId)
  const sp = maxPoints(list)
  const estimate = list.reduce<number | null>(
    (max, e) =>
      e.estimateMinutes !== null && (max === null || e.estimateMinutes > max)
        ? e.estimateMinutes
        : max,
    null,
  )
  const resume = useResumeTask()
  const [summarizing, setSummarizing] = useState(false)

  const back = (
    <Link
      to="/app/tasks"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {t.back}
    </Link>
  )

  if (sessions.isPending)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div
          aria-hidden
          className="mt-4 h-64 animate-pulse rounded-2xl bg-muted"
        />
      </div>
    )
  if (!insights || !latest)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <h1 className="type-display mt-2 text-4xl">{task.title}</h1>
        <p className="mt-4 text-ink-soft">{t.notFound}</p>
      </div>
    )

  const diff = estimate === null ? 0 : insights.minutes - estimate
  const dateShort = (d: string) =>
    formatDate(locale, d, { day: 'numeric', month: 'short' })

  return (
    <div className="mx-auto max-w-6xl">
      {back}
      <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
            {type?.name}
            {project && (
              <>
                <span aria-hidden>·</span>
                <ColorDot color={project.color} />
                {project.name}
              </>
            )}
            {sp !== null && (
              <>
                <span aria-hidden>·</span>
                {format.sp(sp)}
              </>
            )}
          </p>
          <h1 className="type-display mt-1 text-3xl break-words sm:text-4xl">
            {latest.title}
          </h1>
          {latest.link && (
            <a
              href={latest.link}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              <ExternalLink aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{latest.link}</span>
              <span className="sr-only">({t.openLink})</span>
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSummarizing(true)}>
            <ClipboardCopy aria-hidden />
            {t.summary}
          </Button>
          <Button
            disabled={resume.isPending}
            onClick={() => resume.mutate(latest.id)}
          >
            <Play aria-hidden fill="currentColor" className="size-3.5" />
            {t.continue}
          </Button>
        </div>
      </header>

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Stat
          label={t.stats.time}
          value={format.minutes(insights.minutes)}
          hint={[
            estimate !== null
              ? fmt(t.stats.estimate, {
                  estimate: format.minutes(estimate),
                  diff:
                    diff > 0
                      ? fmt(t.stats.over, { time: format.minutes(diff) })
                      : diff < 0
                        ? fmt(t.stats.under, { time: format.minutes(-diff) })
                        : t.stats.exact,
                })
              : sp
                ? `${format.minutes(Math.round(insights.minutes / sp))} / SP`
                : null,
            insights.overtimeMinutes > 0
              ? fmt(t.stats.extra, {
                  overtime: format.minutes(insights.overtimeMinutes),
                })
              : null,
            insights.extensionMinutes > 0
              ? fmt(t.stats.extension, {
                  time: format.minutes(insights.extensionMinutes),
                })
              : null,
          ]
            .filter(Boolean)
            .join('; ')}
          warn={diff > 0}
        />
        <Stat
          label={t.stats.sessions}
          value={String(insights.sessions)}
          hint={fmt(t.stats.average, {
            time: format.minutes(insights.averageSession),
            longest: format.minutes(insights.longestSession),
          })}
        />
        <Stat
          label={t.stats.days}
          value={String(insights.days.length)}
          hint={format
            .plural(
              t.stats.span,
              insights.firstDate === insights.lastDate ? 1 : insights.spanDays,
            )
            .replace('{from}', dateShort(insights.firstDate))
            .replace('{to}', dateShort(insights.lastDate))}
        />
        <Stat
          label={t.stats.interruptions}
          value={String(insights.gaps.length)}
          hint={
            insights.minutesPerInterruption === null
              ? t.stats.none
              : fmt(t.stats.every, {
                  time: format.minutes(insights.minutesPerInterruption),
                })
          }
        />
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Timeline
            insights={insights}
            sessions={list}
            sameDays={sameDays ?? list}
            types={types}
            color={type?.color ?? 'var(--wt-custom)'}
          />
          <Panel title={t.notes.title}>
            <Notes sessions={list} />
          </Panel>
        </div>
        <div className="space-y-6">
          <Interrupted insights={insights} types={types} />
          <div className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
            <TaskDetails
              key={`${task.taskTypeId}|${task.link ?? ''}|${task.title}`}
              entries={list}
              type={type}
              onSaved={(saved) => {
                const next = saved.at(-1)
                if (next)
                  onRename({
                    title: next.title,
                    link: next.link,
                    taskTypeId: next.taskTypeId,
                  })
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <Sessions entries={list} />
      </div>

      {summarizing && (
        <SummaryDialog
          entry={latest}
          type={type}
          onClose={() => setSummarizing(false)}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div className="bg-surface px-4 py-3 sm:px-5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="type-heading mt-0.5 text-2xl tabular-nums">{value}</dd>
      {hint && (
        <dd
          className={cn(
            'mt-1 text-xs',
            warn ? 'font-medium text-destructive' : 'text-ink-soft',
          )}
        >
          {hint}
        </dd>
      )}
    </div>
  )
}

function Panel({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: React.ReactNode
}) {
  const id = `panel-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6"
    >
      <h2 id={id} className="type-heading text-xl">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * Oś dnia: sesje zadania w kolorze typu, inna praca na szaro, luki widać jako puste miejsca.
 * Zakres osi: od najwcześniejszego do najpóźniejszego wpisu z godzinami tego dnia.
 */
function Timeline({
  insights,
  sessions,
  sameDays,
  types,
  color,
}: {
  insights: TaskInsights
  sessions: Array<TimeEntry>
  sameDays: Array<TimeEntry>
  types: Array<TaskType>
  color: string
}) {
  const t = useMessages(taskViewMessages)
  const format = useFormat()
  const { locale, tag } = useI18n()
  const ids = new Set(sessions.map((s) => s.id))

  return (
    <Panel title={t.timeline.title} lead={t.timeline.lead}>
      <ol className="space-y-4">
        {insights.days.map((day) => {
          const all = sameDays.filter(
            (e) => e.workDate === day.date && e.startTime && e.endTime,
          )
          const timed = all.map((e) => ({
            e,
            start: toMinutes(e.startTime!),
            end: toMinutes(e.endTime!),
          }))
          const untimed = sessions
            .filter(
              (s) => s.workDate === day.date && !(s.startTime && s.endTime),
            )
            .reduce((sum, s) => sum + s.durationMinutes, 0)
          const from = Math.min(...timed.map((x) => x.start), 24 * 60)
          const to = Math.max(...timed.map((x) => x.end), 0)
          const span = Math.max(60, to - from)
          return (
            <li key={day.date}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">
                  {formatDate(locale, day.date, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="text-ink-soft tabular-nums">
                  {format.plural(t.timeline.sessions, day.sessions)},{' '}
                  <span className="font-semibold text-ink">
                    {format.minutes(day.minutes)}
                  </span>
                </span>
              </p>
              {timed.length > 0 && (
                <>
                  <div className="relative mt-1.5 h-7 overflow-hidden rounded-md bg-muted">
                    {timed.map(({ e, start, end }) => {
                      const own = ids.has(e.id)
                      const kind = types.find((x) => x.id === e.taskTypeId)
                      const label = own
                        ? fmt(t.timeline.session, {
                            name: e.title,
                            from: clockTime(tag, e.startTime!),
                            to: clockTime(tag, e.endTime!),
                            time: format.minutes(e.durationMinutes),
                          })
                        : fmt(t.timeline.other, {
                            name: `${kind?.name ?? ''} ${e.title}`.trim(),
                            time: format.minutes(e.durationMinutes),
                          })
                      return (
                        <span
                          key={e.id}
                          title={label}
                          className={cn(
                            'absolute inset-y-0 border-x border-surface',
                            own ? 'z-10' : 'bg-ink-soft/35',
                          )}
                          style={{
                            left: `${((start - from) / span) * 100}%`,
                            width: `${(Math.max(1, end - start) / span) * 100}%`,
                            background: own ? color : undefined,
                          }}
                        >
                          <span className="sr-only">{label}</span>
                        </span>
                      )
                    })}
                  </div>
                  <p
                    aria-hidden
                    className="mt-1 flex justify-between text-xs text-ink-soft tabular-nums"
                  >
                    <span>{clockTime(tag, fmtTime(from))}</span>
                    <span>{clockTime(tag, fmtTime(to))}</span>
                  </p>
                </>
              )}
              {untimed > 0 && (
                <p className="mt-1 text-xs text-ink-soft">
                  {fmt(t.timeline.untimed, { time: format.minutes(untimed) })}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

const fmtTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Co wpisało się między sesje: zbiorczo wg zadania, a pod spodem każda luka po kolei. */
function Interrupted({
  insights,
  types,
}: {
  insights: TaskInsights
  types: Array<TaskType>
}) {
  const t = useMessages(taskViewMessages)
  const format = useFormat()
  const { locale, tag } = useI18n()
  return (
    <Panel title={t.interrupted.title} lead={t.interrupted.lead}>
      {insights.interruptedBy.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.interrupted.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {insights.interruptedBy.map((x) => {
            const kind = types.find((k) => k.id === x.taskTypeId)
            return (
              <li
                key={`${x.taskTypeId}|${x.title}`}
                className="flex items-center gap-3 py-2.5"
              >
                <ColorDot color={kind?.color ?? 'var(--wt-custom)'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{x.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {kind?.name}, {format.plural(t.interrupted.times, x.times)}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {format.minutes(x.minutes)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {insights.gaps.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t.interrupted.gaps} ({insights.gaps.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {insights.gaps.map((g) => (
              <li key={`${g.date}-${g.from}`}>
                <span className="tabular-nums">
                  {fmt(t.interrupted.gapLine, {
                    date: formatDate(locale, g.date, {
                      day: 'numeric',
                      month: 'short',
                    }),
                    from: clockTime(tag, g.from),
                    to: clockTime(tag, g.to),
                    time: format.minutes(g.minutes),
                  })}
                </span>
                <span className="text-ink-soft">
                  {': '}
                  {g.between.length
                    ? g.between.map((b) => b.title).join(', ')
                    : t.interrupted.nothing}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}

/** Notatki z sesji, z nadgodzinami i przedłużeniami, od najstarszej. */
function Notes({ sessions }: { sessions: Array<TimeEntry> }) {
  const t = useMessages(taskViewMessages)
  const { locale } = useI18n()
  const notes = sessions.flatMap((s) =>
    [
      s.note ? { label: null, text: s.note } : null,
      s.overtimeNote ? { label: t.notes.overtime, text: s.overtimeNote } : null,
      s.extensionNote
        ? { label: t.notes.extension, text: s.extensionNote }
        : null,
    ]
      .filter((x) => x !== null)
      .map((x) => ({
        ...x,
        id: `${s.id}-${x.label ?? 'note'}`,
        date: s.workDate,
      })),
  )
  if (notes.length === 0)
    return <p className="text-sm text-ink-soft">{t.notes.empty}</p>
  return (
    <ol className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="text-sm">
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            {formatDate(locale, n.date, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            {n.label && <Badge tone="muted">{n.label}</Badge>}
          </p>
          <p className="mt-0.5 whitespace-pre-line">{n.text}</p>
        </li>
      ))}
    </ol>
  )
}
