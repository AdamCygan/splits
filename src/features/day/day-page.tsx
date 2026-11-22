import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckableNote } from '#/components/note/note-markdown'
import { buttonVariants } from '#/components/ui/button'
import { Badge, ColorDot } from '#/components/ui/controls'
import type { TaskType, TimeEntry } from '#/data/types'
import { stackOrder } from '#/domain/analytics'
import { addDays, todayIn } from '#/domain/dates'
import { daySummary } from '#/domain/day-summary'
import type { DayBlock, DaySummary } from '#/domain/day-summary'
import { taskGroupKey } from '#/domain/report'
import {
  daysOffQuery,
  projectsQuery,
  settingsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { TaskLink } from '#/features/tasks/task-link'
import { clockTime } from '#/features/time-entries/components/timer'
import { breaksQuery, rangeEntriesQuery } from '#/features/time-entries/queries'
import { useUpdateNote } from '#/features/time-entries/use-update-note'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import { cn } from '#/lib/utils'

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Kolor typu pracy (z zapasowym, gdy typ zniknął). */
const colorOf = (types: ReadonlyArray<TaskType>, id: string | null) =>
  types.find((x) => x.id === id)?.color ?? 'var(--wt-custom)'

/**
 * Podsumowanie jednego dnia, otwierane z wykresu „Czas dzień po dniu” w Raportach:
 * sumy, oś dnia, podział na rodzaje pracy i zadania z notatkami.
 */
export function DayPage({ date }: { date: string }) {
  const t = useMessages(dayViewMessages)
  const { locale, tag } = useI18n()
  const settings = useQuery(settingsQuery).data
  const types = useQuery(taskTypesQuery).data ?? []
  const entries = useQuery(rangeEntriesQuery(date, date))
  const breaks = useQuery(breaksQuery(date)).data ?? []
  const dayOff = useQuery(daysOffQuery(date, date)).data?.[0]
  const today = todayIn(settings?.timezone)
  const list = (entries.data ?? []).filter((e) => !e.running)
  const summary = daySummary(
    list,
    breaks.filter((b) => !b.running),
    types,
  )

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t.back}
        </Link>
        <div className="flex gap-2">
          <Link
            to="/app/day"
            search={{ date: addDays(date, -1) }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t.previous}
          </Link>
          {date < today && (
            <Link
              to="/app/day"
              search={{ date: addDays(date, 1) }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t.next}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      </nav>

      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-display text-3xl sm:text-4xl">
            {formatDate(locale, date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h1>
          {(summary.span || dayOff) && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-soft tabular-nums">
              {summary.span &&
                fmt(t.stats.dayFrom, {
                  from: clockTime(tag, hhmm(summary.span.start)),
                  to: clockTime(tag, hhmm(summary.span.end)),
                })}
              {dayOff && <Badge tone="muted">{t.dayOff[dayOff.kind]}</Badge>}
            </p>
          )}
        </div>
        <Link
          to="/app"
          search={{ date }}
          className={buttonVariants({ variant: 'outline' })}
        >
          <Pencil aria-hidden className="size-4" />
          {t.edit}
        </Link>
      </header>

      {entries.isPending ? (
        <div aria-hidden className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{t.empty}</p>
          <Link
            to="/app"
            search={{ date }}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {t.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <Stats
            summary={summary}
            target={settings?.workdayTargetMinutes ?? 0}
          />
          <DayTimeline summary={summary} types={types} />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Tasks summary={summary} entries={list} types={types} />
            <TypeShare summary={summary} types={types} />
          </div>
        </>
      )}
    </div>
  )
}

function Stats({ summary, target }: { summary: DaySummary; target: number }) {
  const t = useMessages(dayViewMessages).stats
  const format = useFormat()
  const percent = target > 0 ? Math.round((summary.minutes / target) * 100) : 0
  return (
    <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      <Stat
        label={t.worked}
        value={format.minutes(summary.minutes)}
        hint={[
          target > 0
            ? fmt(t.target, { percent, target: format.minutes(target) })
            : null,
          summary.overtimeMinutes > 0
            ? fmt(t.overtime, { time: format.minutes(summary.overtimeMinutes) })
            : null,
        ]
          .filter(Boolean)
          .join('; ')}
      />
      <Stat
        label={t.focus}
        value={format.minutes(summary.focusMinutes)}
        hint={[
          summary.longestFocus > 0
            ? fmt(t.longest, { time: format.minutes(summary.longestFocus) })
            : null,
          summary.switches > 0
            ? format.plural(t.switches, summary.switches)
            : null,
        ]
          .filter(Boolean)
          .join('; ')}
      />
      <Stat
        label={t.meetings}
        value={format.minutes(summary.meetingMinutes)}
        hint={format.plural(t.meetingCount, summary.meetings)}
      />
      <Stat
        label={t.breaks}
        value={format.minutes(summary.breakMinutes)}
        hint={
          summary.breaks === 0
            ? t.noBreaks
            : format.plural(t.breakCount, summary.breaks)
        }
      />
    </dl>
  )
}

function Stat({
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
      <dd className="type-heading mt-0.5 text-2xl tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-ink-soft">{hint}</dd>}
    </div>
  )
}

function Panel({
  title,
  lead,
  className,
  children,
}: {
  title: string
  lead?: string
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'min-w-0 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6',
        className,
      )}
    >
      <h2 id={id} className="type-heading text-xl">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const BREAK_FILL =
  'repeating-linear-gradient(135deg, var(--ink-faint) 0 2px, transparent 2px 6px)'

/**
 * Oś dnia: sesje w kolorze rodzaju pracy, przerwy w paski. Mysz albo strzałki wybierają
 * odcinek (dymek ze szczegółami), kliknięcie albo Enter otwiera zadanie.
 */
function DayTimeline({
  summary,
  types,
}: {
  summary: DaySummary
  types: ReadonlyArray<TaskType>
}) {
  const t = useMessages(dayViewMessages).timeline
  const format = useFormat()
  const { tag } = useI18n()
  const navigate = useNavigate()
  const [active, setActive] = useState<number | null>(null)
  const liveId = useId()
  const { blocks, span } = summary
  const used = stackOrder(
    types.filter((x) => blocks.some((b) => b.taskTypeId === x.id)),
  )

  if (!span)
    return (
      <Panel title={t.title} lead={t.lead}>
        <p className="text-sm text-ink-soft">{t.noTimes}</p>
        {summary.untimedMinutes > 0 && (
          <p className="mt-1 text-sm text-ink-soft">
            {fmt(t.untimed, { time: format.minutes(summary.untimedMinutes) })}
          </p>
        )}
      </Panel>
    )

  const from = Math.floor(span.start / 60) * 60
  const to = Math.max(from + 60, Math.ceil(span.end / 60) * 60)
  const hours = (to - from) / 60
  const step = hours > 12 ? 3 : hours > 8 ? 2 : 1
  const ticks = Array.from(
    { length: Math.floor(hours / step) + 1 },
    (_, i) => from + i * step * 60,
  )
  const x = (m: number) => ((m - from) / (to - from)) * 100
  const labelOf = (b: DayBlock) =>
    fmt(t.block, {
      name:
        b.kind === 'break'
          ? t.break
          : `${types.find((k) => k.id === b.taskTypeId)?.name ?? ''}: ${b.title}`,
      from: clockTime(tag, hhmm(b.start)),
      to: clockTime(tag, hhmm(b.end)),
      time: format.minutes(b.minutes),
    })
  const open = (b: DayBlock | undefined) => {
    const row = summary.tasks.find((r) => r.key === b?.taskKey)
    if (!b || b.kind !== 'work' || !row) return
    void navigate({
      to: '/app/task',
      search: {
        type: row.taskTypeId,
        title: row.title,
        ...(row.link ? { link: row.link } : {}),
      },
    })
  }
  const current = active !== null ? blocks[active] : undefined

  return (
    <Panel title={t.title} lead={t.lead} className="mt-6">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {used.map((k) => (
          <li key={k.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: k.color }}
            />
            {k.name}
          </li>
        ))}
        {blocks.some((b) => b.kind === 'break') && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full border border-ink-faint"
              style={{ background: BREAK_FILL }}
            />
            {t.break}
          </li>
        )}
      </ul>
      <div className="relative pt-1">
        <div
          role="group"
          tabIndex={0}
          aria-label={t.keys}
          aria-describedby={liveId}
          className="relative h-14 cursor-pointer rounded-md bg-muted outline-offset-4"
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect()
            const m = from + ((e.clientX - box.left) / box.width) * (to - from)
            const i = blocks.findIndex((b) => m >= b.start && m <= b.end)
            setActive(i === -1 ? null : i)
          }}
          onPointerLeave={() => setActive(null)}
          onClick={(e) => {
            // Odcinek pod kursorem (także przy dotyku, gdzie nie ma najechania).
            const box = e.currentTarget.getBoundingClientRect()
            const m = from + ((e.clientX - box.left) / box.width) * (to - from)
            open(blocks.find((b) => m >= b.start && m <= b.end))
          }}
          onFocus={() => setActive((v) => v ?? 0)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            const move =
              e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (move)
              setActive((v) =>
                Math.min(blocks.length - 1, Math.max(0, (v ?? -1) + move)),
              )
            else if (e.key === 'Home') setActive(0)
            else if (e.key === 'End') setActive(blocks.length - 1)
            else if (e.key === 'Enter' || e.key === ' ') open(current)
            else return
            e.preventDefault()
          }}
        >
          {blocks.map((b, i) => (
            <span
              key={b.id}
              aria-hidden
              className={cn(
                'pointer-events-none absolute border-x border-surface',
                b.kind === 'break' ? 'inset-y-3 rounded-sm' : 'inset-y-0',
                active === i && 'z-10 ring-2 ring-ink ring-offset-1',
              )}
              style={{
                left: `${x(b.start)}%`,
                width: `max(3px, ${x(b.end) - x(b.start)}%)`,
                background:
                  b.kind === 'break'
                    ? BREAK_FILL
                    : colorOf(types, b.taskTypeId),
              }}
            />
          ))}
        </div>
        <p id={liveId} aria-live="polite" className="sr-only">
          {current ? labelOf(current) : ''}
        </p>
        {current && (
          <div
            role="presentation"
            className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(Math.max(x((current.start + current.end) / 2), 12), 88)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold">
              {current.kind === 'break' ? t.break : current.title}
            </p>
            <p className="mt-0.5 text-ink-soft tabular-nums">
              {clockTime(tag, hhmm(current.start))}–
              {clockTime(tag, hhmm(current.end))},{' '}
              {format.minutes(current.minutes)}
            </p>
            {current.kind === 'work' && (
              <p className="mt-0.5 text-ink-soft">{t.open}</p>
            )}
          </div>
        )}
        <div
          aria-hidden
          className="relative mt-1.5 h-4 text-xs text-ink-soft tabular-nums"
        >
          {ticks.map((m, i) => (
            <span
              key={m}
              className={cn(
                'absolute',
                i === 0
                  ? 'left-0'
                  : i === ticks.length - 1
                    ? 'right-0'
                    : '-translate-x-1/2',
              )}
              style={
                i === 0 || i === ticks.length - 1
                  ? undefined
                  : { left: `${x(m)}%` }
              }
            >
              {clockTime(tag, hhmm(m))}
            </span>
          ))}
        </div>
      </div>
      {summary.untimedMinutes > 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          {fmt(t.untimed, { time: format.minutes(summary.untimedMinutes) })}
        </p>
      )}
    </Panel>
  )
}

/** Udział rodzajów pracy: poziome paski od największego, z czasem i procentem. */
function TypeShare({
  summary,
  types,
}: {
  summary: DaySummary
  types: ReadonlyArray<TaskType>
}) {
  const t = useMessages(dayViewMessages).types
  const format = useFormat()
  const top = summary.byType[0]?.minutes ?? 1
  return (
    <Panel title={t.title} lead={t.lead}>
      <ul className="space-y-3">
        {summary.byType.map((row) => {
          const type = types.find((x) => x.id === row.taskTypeId)
          const percent = Math.round((row.minutes / summary.minutes) * 100)
          return (
            <li key={row.taskTypeId}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {type?.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">
                    {format.minutes(row.minutes)}
                  </span>{' '}
                  <span className="text-ink-soft">
                    {fmt(t.share, { percent })}
                  </span>
                </span>
              </p>
              <span
                aria-hidden
                className="mt-1 block h-2 rounded-r-[4px]"
                style={{
                  width: `${(row.minutes / top) * 100}%`,
                  background: type?.color ?? 'var(--wt-custom)',
                }}
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Zadania dnia od najdłuższego: czas, sesje z godzinami, SP i notatki z tego dnia. */
function Tasks({
  summary,
  entries,
  types,
}: {
  summary: DaySummary
  entries: ReadonlyArray<TimeEntry>
  types: ReadonlyArray<TaskType>
}) {
  const t = useMessages(dayViewMessages).tasks
  const format = useFormat()
  const { tag } = useI18n()
  const projects = useQuery(projectsQuery).data ?? []
  const updateNote = useUpdateNote()
  return (
    <Panel title={t.title} lead={t.lead}>
      <ul className="divide-y divide-line">
        {summary.tasks.map((row) => {
          const type = types.find((x) => x.id === row.taskTypeId)
          const project = projects.find((p) => p.id === row.projectId)
          const sessions = entries
            .filter((e) => taskGroupKey(e) === row.key)
            .sort((a, b) =>
              (a.startTime ?? '99').localeCompare(b.startTime ?? '99'),
            )
          return (
            <li key={row.key} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <ColorDot
                  className="mt-1.5"
                  color={type?.color ?? 'var(--wt-custom)'}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="min-w-0 font-semibold break-words">
                      <TaskLink task={row}>{row.title}</TaskLink>
                    </h3>
                    <span className="font-semibold tabular-nums">
                      {format.minutes(row.minutes)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                    <span>{type?.name}</span>
                    {row.storyPoints !== null && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{format.sp(row.storyPoints)}</span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {format.plural(t.sessions, row.sessions)}:{' '}
                      {sessions
                        .map((s) =>
                          s.startTime && s.endTime
                            ? `${clockTime(tag, s.startTime)}–${clockTime(tag, s.endTime)}`
                            : t.untimed,
                        )
                        .join(', ')}
                    </span>
                    {project && (
                      <Badge tone="muted">{project.key ?? project.name}</Badge>
                    )}
                  </p>
                  {sessions.map((s) => (
                    <div key={s.id} className="contents">
                      {s.note && (
                        <CheckableNote
                          className="mt-2 rounded-lg bg-muted/60 px-3 py-2"
                          text={s.note}
                          headingLevel={4}
                          onSave={(note) =>
                            updateNote.mutateAsync({ id: s.id, note })
                          }
                        />
                      )}
                      {s.overtimeNote && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">{t.overtime}: </span>
                          {s.overtimeNote}
                        </p>
                      )}
                      {s.extensionNote && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">{t.extension}: </span>
                          {s.extensionNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
