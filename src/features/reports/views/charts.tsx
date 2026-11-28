import type { ChartBucket } from '../domain/charts'
import { Panel } from '#/components/ui/panel'
import {
  estimateMisses,
  hourHeatmap,
  hourTicks,
  stackOrder,
  timeBuckets,
} from '#/features/reports/domain/analytics'
import type { TaskRow } from '#/features/reports/domain/report'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export interface ChartCardProps {
  title: string
  lead?: string
  legend?: ReactNode
  table?: ReactNode
  className?: string
  children: ReactNode
}

/** Karta wykresu: tytuł, opis, opcjonalna legenda nad wykresem i tabela pod nim. */
export function ChartCard({
  title,
  lead,
  legend,
  table,
  className,
  children,
}: ChartCardProps) {
  const messages = useMessages(reportsMessages).charts
  return (
    <Panel
      title={title}
      lead={lead}
      level={3}
      headerExtra={legend}
      className={className}
    >
      {children}
      {table && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft hover:text-ink">
            {messages.showTable}
          </summary>
          <div
            tabIndex={0}
            role="region"
            aria-label={fmt(messages.scrollRegion, { title })}
            className="relative mt-2 overflow-x-auto rounded-sm"
          >
            {table}
          </div>
        </details>
      )}
    </Panel>
  )
}

interface LegendProps {
  items: Array<{ key: string; label: string; color: string }>
}

function Legend({ items }: LegendProps) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipProps {
  left: number
  title: string
  rows: Array<{ key: string; color?: string; label: string; value: string }>
  hint?: string
}

/** Dymek nad wskazaną kolumną: najpierw wartość, potem nazwa serii. */
function Tooltip({ left, title, rows, hint }: TooltipProps) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-0 z-20 w-max max-w-56 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{
        left: `${Math.min(Math.max(left, 14), 86)}%`,
        transform: 'translateX(-50%)',
      }}
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            {row.color && (
              <span
                aria-hidden
                className="h-0.5 w-3 rounded-full"
                style={{ background: row.color }}
              />
            )}
            <span className="font-semibold tabular-nums">{row.value}</span>
            <span className="text-ink-soft">{row.label}</span>
          </li>
        ))}
      </ul>
      {hint && <p className="mt-1.5 text-ink-soft">{hint}</p>}
    </div>
  )
}

export interface TimeChartProps {
  entries: ReadonlyArray<TimeEntry>
  from: string
  to: string
  types: ReadonlyArray<TaskType>
  className?: string
  /** Kliknięcie albo Enter na kolumnie: dzień (albo tydzień) do otwarcia ze szczegółami. */
  onOpen?: (bucket: ChartBucket) => void
}

/**
 * Czas dzień po dniu (albo tydzień po tygodniu) z podziałem na typy pracy: kolumny
 * z warstwami, oś godzin, dymek z rozbiciem po najechaniu albo fokusie.
 */
export function TimeChart({
  entries,
  from,
  to,
  types,
  className,
  onOpen,
}: TimeChartProps) {
  const messages = useMessages(reportsMessages).charts
  const format = useFormat()
  const { locale } = useI18n()
  const [active, setActive] = useState<number | null>(null)
  const { unit, buckets } = timeBuckets(entries, from, to)
  const used = stackOrder(
    types.filter((taskType) =>
      buckets.some((timeBucket) => timeBucket.byType[taskType.id]),
    ),
  )
  const max = Math.max(...buckets.map((timeBucket) => timeBucket.minutes), 60)
  const ticks = hourTicks(max)
  const top = ticks.at(-1)!
  const label = (timeBucket: (typeof buckets)[number]) =>
    unit === 'day'
      ? format.day(timeBucket.from)
      : fmt(messages.week, {
          from: formatDate(locale, timeBucket.from, {
            day: 'numeric',
            month: 'short',
          }),
          to: formatDate(locale, timeBucket.to, {
            day: 'numeric',
            month: 'short',
          }),
        })
  const short = (timeBucket: (typeof buckets)[number]) =>
    formatDate(locale, timeBucket.from, {
      day: 'numeric',
      month: unit === 'day' ? undefined : 'short',
    })
  const every = Math.ceil(buckets.length / 10)
  const liveId = useId()
  const lastWithData = buckets.reduce(
    (last, timeBucket, index) => (timeBucket.minutes > 0 ? index : last),
    0,
  )
  const breakdown = (timeBucket: (typeof buckets)[number]) =>
    used
      .filter((taskType) => timeBucket.byType[taskType.id])
      .map((taskType) => ({
        key: taskType.id,
        color: taskType.color,
        label: taskType.name,
        value: format.minutes(timeBucket.byType[taskType.id]!),
      }))
      .reverse()
  const describe = (timeBucket: (typeof buckets)[number]) =>
    `${label(timeBucket)}: ${format.minutes(timeBucket.minutes)}${
      timeBucket.minutes
        ? `, ${breakdown(timeBucket)
            .map((row) => `${row.label} ${row.value}`)
            .join(', ')}`
        : ''
    }`

  return (
    <ChartCard
      className={className}
      title={unit === 'day' ? messages.daily.title : messages.daily.titleWeekly}
      lead={messages.daily.lead}
      legend={
        <Legend
          items={used.map((taskType) => ({
            key: taskType.id,
            label: taskType.name,
            color: taskType.color,
          }))}
        />
      }
      table={
        <table className="w-full text-left tabular-nums">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-3 font-medium">{messages.daily.when}</th>
              {used.map((taskType) => (
                <th
                  key={taskType.id}
                  className="py-1 pr-3 text-right font-medium"
                >
                  {taskType.name}
                </th>
              ))}
              <th className="py-1 text-right font-medium">{messages.total}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((timeBucket) => (
              <tr key={timeBucket.from} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 font-normal">
                  {label(timeBucket)}
                </th>
                {used.map((taskType) => (
                  <td key={taskType.id} className="py-1 pr-3 text-right">
                    {timeBucket.byType[taskType.id]
                      ? format.minutes(timeBucket.byType[taskType.id]!)
                      : '–'}
                  </td>
                ))}
                <td className="py-1 text-right font-semibold">
                  {format.minutes(timeBucket.minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="flex gap-2 pt-3">
        <div
          aria-hidden
          className="relative h-48 w-9 shrink-0 text-right text-xs text-ink-soft tabular-nums"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tick / 60}h
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-48">
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden
                className="absolute inset-x-0 border-t border-line"
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}
            {/* Jeden element do wskazywania: mysz wybiera kolumnę po X, klawiatura strzałkami. */}
            <div
              role="group"
              tabIndex={0}
              aria-label={
                onOpen ? messages.daily.keysOpen : messages.daily.keys
              }
              aria-describedby={liveId}
              className={cn(
                'absolute inset-0 rounded-sm outline-offset-4',
                onOpen && 'cursor-pointer',
              )}
              onClick={(event) => {
                // Kolumna pod kursorem (także przy dotyku, gdzie nie ma najechania).
                const box = event.currentTarget.getBoundingClientRect()
                const index = Math.floor(
                  ((event.clientX - box.left) / box.width) * buckets.length,
                )
                const bucket =
                  buckets[Math.min(buckets.length - 1, Math.max(0, index))]
                if (onOpen && bucket && bucket.minutes > 0)
                  onOpen({ from: bucket.from, to: bucket.to, unit })
              }}
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                const index = Math.floor(
                  ((event.clientX - box.left) / box.width) * buckets.length,
                )
                setActive(Math.min(buckets.length - 1, Math.max(0, index)))
              }}
              onPointerLeave={() => setActive(null)}
              onFocus={() =>
                setActive((previousIndex) => previousIndex ?? lastWithData)
              }
              onBlur={() => setActive(null)}
              onKeyDown={(event) => {
                const step =
                  event.key === 'ArrowRight'
                    ? 1
                    : event.key === 'ArrowLeft'
                      ? -1
                      : 0
                const timeBucket = active !== null ? buckets[active] : undefined
                if (
                  (event.key === 'Enter' || event.key === ' ') &&
                  onOpen &&
                  timeBucket
                ) {
                  event.preventDefault()
                  onOpen({ from: timeBucket.from, to: timeBucket.to, unit })
                  return
                }
                if (event.key === 'Home') setActive(0)
                else if (event.key === 'End') setActive(buckets.length - 1)
                else if (step)
                  setActive((previousIndex) =>
                    Math.min(
                      buckets.length - 1,
                      Math.max(0, (previousIndex ?? lastWithData) + step),
                    ),
                  )
                else return
                event.preventDefault()
              }}
            >
              <ol
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-end justify-around"
              >
                {buckets.map((timeBucket, index) => (
                  <li
                    key={timeBucket.from}
                    className={cn(
                      'flex h-full min-w-0 flex-1 justify-center',
                      active === index && 'bg-muted/70',
                    )}
                  >
                    <span className="flex h-full w-full max-w-6 flex-col-reverse items-stretch px-px">
                      {used.map((taskType) =>
                        timeBucket.byType[taskType.id] ? (
                          <span
                            key={taskType.id}
                            className="block border-t-2 border-surface first:border-t-0 last:rounded-t-[4px]"
                            style={{
                              height: `${(timeBucket.byType[taskType.id]! / top) * 100}%`,
                              background: taskType.color,
                            }}
                          />
                        ) : null,
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p id={liveId} aria-live="polite" className="sr-only">
              {active !== null ? describe(buckets[active]!) : ''}
            </p>
            {active !== null && buckets[active]!.minutes > 0 && (
              <Tooltip
                left={((active + 0.5) / buckets.length) * 100}
                title={`${label(buckets[active]!)} · ${format.minutes(buckets[active]!.minutes)}`}
                rows={breakdown(buckets[active]!)}
                hint={
                  onOpen
                    ? unit === 'day'
                      ? messages.daily.openDay
                      : messages.daily.openWeek
                    : undefined
                }
              />
            )}
          </div>
          <div
            aria-hidden
            className="mt-1.5 flex justify-around text-xs text-ink-soft tabular-nums"
          >
            {buckets.map((timeBucket, index) => (
              <span
                key={timeBucket.from}
                className="min-w-0 flex-1 text-center"
              >
                {index % every === 0 ? short(timeBucket) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

export interface HourHeatmapProps {
  entries: ReadonlyArray<TimeEntry>
  className?: string
}

/**
 * Kiedy pracujesz: siatka dzień tygodnia × godzina, jeden odcień od jasnego do ciemnego.
 * Tylko wpisy z godzinami od–do.
 */
export function HourHeatmap({ entries, className }: HourHeatmapProps) {
  const messages = useMessages(reportsMessages).charts
  const format = useFormat()
  const { locale } = useI18n()
  const map = hourHeatmap(entries)
  const hours = Array.from(
    { length: map.lastHour - map.firstHour + 1 },
    (_unused, index) => map.firstHour + index,
  )
  // 2026-11-16 to poniedziałek: z niego bierzemy nazwy dni w języku użytkownika.
  const days = Array.from({ length: 7 }, (_unused, index) =>
    formatDate(locale, `2026-11-${16 + index}`, { weekday: 'short' }),
  )
  const level = (minutes: number) =>
    minutes === 0
      ? 0
      : Math.min(4, Math.ceil((minutes / Math.max(1, map.max)) * 4))
  const SHADES = ['var(--muted)', '18%', '40%', '68%', '100%']
  const fill = (intensity: number) =>
    intensity === 0
      ? SHADES[0]
      : `color-mix(in oklab, var(--wt-task) ${SHADES[intensity]}, var(--surface))`

  if (map.max === 0)
    return (
      <ChartCard
        title={messages.hours.title}
        lead={messages.hours.lead}
        className={className}
      >
        <p className="text-sm text-ink-soft">{messages.hours.empty}</p>
      </ChartCard>
    )

  return (
    <ChartCard
      className={className}
      title={messages.hours.title}
      lead={messages.hours.lead}
      legend={
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          {messages.hours.less}
          {[1, 2, 3, 4].map((limit) => (
            <span
              key={limit}
              aria-hidden
              className="size-3 rounded-[3px]"
              style={{ background: fill(limit) }}
            />
          ))}
          {messages.hours.more}
        </div>
      }
    >
      <div
        tabIndex={0}
        role="region"
        aria-label={fmt(messages.scrollRegion, { title: messages.hours.title })}
        className="relative overflow-x-auto rounded-sm"
      >
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th scope="col" className="w-10">
                <span className="sr-only">{messages.dayColumn}</span>
              </th>
              {hours.map((hour) => (
                <th
                  key={hour}
                  scope="col"
                  className="font-normal text-ink-soft tabular-nums"
                >
                  {hour % 2 === 0 || hours.length < 10 ? hour : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {map.cells.map((row, index) => (
              <tr key={index}>
                <th
                  scope="row"
                  className="pr-1 text-left font-normal text-ink-soft"
                >
                  {days[index]}
                </th>
                {hours.map((hour) => {
                  const rowItem = row[hour]!
                  const text = fmt(messages.hours.cell, {
                    day: days[index]!,
                    hour: `${hour}:00–${hour + 1}:00`,
                    time: format.minutes(rowItem),
                  })
                  return (
                    <td
                      key={hour}
                      title={text}
                      className="h-6 min-w-5 rounded-[3px]"
                      style={{ background: fill(level(rowItem)) }}
                    >
                      <span className="sr-only">{text}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}

export interface EstimateChartProps {
  rows: ReadonlyArray<TaskRow>
}

/** Trafność estymat: o ile zadania wyszły ponad (w prawo) albo poniżej (w lewo) estymaty. */
export function EstimateChart({ rows }: EstimateChartProps) {
  const messages = useMessages(reportsMessages).charts
  const format = useFormat()
  const misses = estimateMisses(rows)
  if (misses.length === 0)
    return (
      <ChartCard
        title={messages.estimates.title}
        lead={messages.estimates.lead}
      >
        <p className="text-sm text-ink-soft">{messages.estimates.empty}</p>
      </ChartCard>
    )
  const scale = Math.max(
    ...misses.map((estimateMiss) => Math.abs(estimateMiss.diff)),
    1,
  )
  return (
    <ChartCard
      title={messages.estimates.title}
      lead={messages.estimates.lead}
      legend={
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px] bg-[var(--wt-pair)]"
            />
            {messages.estimates.under}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-wt-review" />
            {messages.estimates.over}
          </li>
        </ul>
      }
    >
      <ul className="space-y-3">
        {misses.map((estimateMiss) => {
          const width = (Math.abs(estimateMiss.diff) / scale) * 50
          const value =
            estimateMiss.diff === 0
              ? messages.estimates.exact
              : `${estimateMiss.diff > 0 ? '+' : '−'}${format.minutes(Math.abs(estimateMiss.diff))}`
          return (
            <li key={estimateMiss.key}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">
                  {estimateMiss.title}
                </span>
                <span className="shrink-0 text-ink-soft tabular-nums">
                  {fmt(messages.estimates.row, {
                    time: format.minutes(estimateMiss.minutes),
                    estimate: format.minutes(estimateMiss.estimate),
                  })}
                </span>
              </p>
              <div className="mt-1 flex items-center gap-3">
                <div className="relative h-4 flex-1">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-px bg-line"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1/2 h-2.5 -translate-y-1/2',
                      estimateMiss.diff > 0
                        ? 'left-1/2 rounded-r-[4px] bg-wt-review'
                        : 'right-1/2 rounded-l-[4px] bg-[var(--wt-pair)]',
                    )}
                    style={{ width: `${Math.max(width, 0.5)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {value}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {misses.length < 3 && (
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
          {messages.estimates.few}
        </p>
      )}
    </ChartCard>
  )
}

export interface ColumnChartProps {
  title: string
  lead?: string
  items: Array<{ key: string; label: string; value: number; display: string }>
  color?: string
}

/** Jedna seria w kolumnach (np. SP na sprint): wartość nad kolumną, dymek przy fokusie. */
export function ColumnChart({
  title,
  lead,
  items,
  color = 'var(--wt-task)',
}: ColumnChartProps) {
  const messages = useMessages(reportsMessages).charts
  const max = Math.max(...items.map((item) => item.value), 1)
  // Same zera (np. świeże konto): zamiast pustych słupków krótka informacja.
  if (items.every((item) => item.value === 0))
    return (
      <ChartCard title={title} lead={lead}>
        <p className="text-sm text-ink-soft">{messages.noData}</p>
      </ChartCard>
    )
  return (
    <ChartCard title={title} lead={lead}>
      <ol className="flex h-40 items-end justify-around gap-1 border-b border-line">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
          >
            {/* Podpis słupka dla czytników (widoczne podpisy są pod osią, ukryte przed nimi). */}
            <span className="sr-only">{item.label}: </span>
            <span className="mb-1 text-xs font-semibold tabular-nums">
              {item.display}
            </span>
            <span
              aria-hidden
              className="block w-full max-w-6 rounded-t-[4px]"
              style={{
                height: `${(item.value / max) * 80}%`,
                minHeight: item.value > 0 ? 2 : 0,
                background: color,
              }}
            />
          </li>
        ))}
      </ol>
      <div
        aria-hidden
        className="mt-1.5 flex justify-around gap-1 text-xs text-ink-soft"
      >
        {items.map((item) => (
          <span key={item.key} className="min-w-0 flex-1 truncate text-center">
            {item.label}
          </span>
        ))}
      </div>
    </ChartCard>
  )
}
