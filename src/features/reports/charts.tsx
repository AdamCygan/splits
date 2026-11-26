import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { TaskType, TimeEntry } from '#/data/types'
import {
  estimateMisses,
  hourHeatmap,
  hourTicks,
  stackOrder,
  timeBuckets,
} from '#/domain/analytics'
import type { TaskRow } from '#/domain/report'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'

/** Karta wykresu: tytuł, opis, opcjonalna legenda nad wykresem i tabela pod nim. */
export function ChartCard({
  title,
  lead,
  legend,
  table,
  className,
  children,
}: {
  title: string
  lead?: string
  legend?: ReactNode
  table?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const t = useMessages(reportsMessages).charts
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6',
        className,
      )}
    >
      <h3 id={id} className="type-heading text-xl">
        {title}
      </h3>
      {lead && <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
      {legend && <div className="mt-3">{legend}</div>}
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft hover:text-ink">
            {t.showTable}
          </summary>
          <div
            tabIndex={0}
            role="region"
            aria-label={title}
            className="mt-2 overflow-x-auto rounded-sm"
          >
            {table}
          </div>
        </details>
      )}
    </section>
  )
}

function Legend({
  items,
}: {
  items: Array<{ key: string; label: string; color: string }>
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** Dymek nad wskazaną kolumną: najpierw wartość, potem nazwa serii. */
function Tooltip({
  left,
  title,
  rows,
  hint,
}: {
  left: number
  title: string
  rows: Array<{ key: string; color?: string; label: string; value: string }>
  hint?: string
}) {
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
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.color && (
              <span
                aria-hidden
                className="h-0.5 w-3 rounded-full"
                style={{ background: r.color }}
              />
            )}
            <span className="font-semibold tabular-nums">{r.value}</span>
            <span className="text-ink-soft">{r.label}</span>
          </li>
        ))}
      </ul>
      {hint && <p className="mt-1.5 text-ink-soft">{hint}</p>}
    </div>
  )
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
}: {
  entries: ReadonlyArray<TimeEntry>
  from: string
  to: string
  types: ReadonlyArray<TaskType>
  className?: string
  /** Kliknięcie albo Enter na kolumnie: dzień (albo tydzień) do otwarcia ze szczegółami. */
  onOpen?: (bucket: { from: string; to: string; unit: 'day' | 'week' }) => void
}) {
  const t = useMessages(reportsMessages).charts
  const format = useFormat()
  const { locale } = useI18n()
  const [active, setActive] = useState<number | null>(null)
  const { unit, buckets } = timeBuckets(entries, from, to)
  const used = stackOrder(
    types.filter((x) => buckets.some((b) => b.byType[x.id])),
  )
  const max = Math.max(...buckets.map((b) => b.minutes), 60)
  const ticks = hourTicks(max)
  const top = ticks.at(-1)!
  const label = (b: (typeof buckets)[number]) =>
    unit === 'day'
      ? formatDate(locale, b.from, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : fmt(t.week, {
          from: formatDate(locale, b.from, { day: 'numeric', month: 'short' }),
          to: formatDate(locale, b.to, { day: 'numeric', month: 'short' }),
        })
  const short = (b: (typeof buckets)[number]) =>
    formatDate(locale, b.from, {
      day: 'numeric',
      month: unit === 'day' ? undefined : 'short',
    })
  const every = Math.ceil(buckets.length / 10)
  const liveId = useId()
  const lastWithData = buckets.reduce(
    (last, b, i) => (b.minutes > 0 ? i : last),
    0,
  )
  const breakdown = (b: (typeof buckets)[number]) =>
    used
      .filter((x) => b.byType[x.id])
      .map((x) => ({
        key: x.id,
        color: x.color,
        label: x.name,
        value: format.minutes(b.byType[x.id]!),
      }))
      .reverse()
  const describe = (b: (typeof buckets)[number]) =>
    `${label(b)}: ${format.minutes(b.minutes)}${
      b.minutes
        ? `, ${breakdown(b)
            .map((r) => `${r.label} ${r.value}`)
            .join(', ')}`
        : ''
    }`

  return (
    <ChartCard
      className={className}
      title={unit === 'day' ? t.daily.title : t.daily.titleWeekly}
      lead={t.daily.lead}
      legend={
        <Legend
          items={used.map((x) => ({
            key: x.id,
            label: x.name,
            color: x.color,
          }))}
        />
      }
      table={
        <table className="w-full text-left tabular-nums">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-3 font-medium">{t.daily.when}</th>
              {used.map((x) => (
                <th key={x.id} className="py-1 pr-3 text-right font-medium">
                  {x.name}
                </th>
              ))}
              <th className="py-1 text-right font-medium">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.from} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 font-normal">
                  {label(b)}
                </th>
                {used.map((x) => (
                  <td key={x.id} className="py-1 pr-3 text-right">
                    {b.byType[x.id] ? format.minutes(b.byType[x.id]!) : '–'}
                  </td>
                ))}
                <td className="py-1 text-right font-semibold">
                  {format.minutes(b.minutes)}
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
          {ticks.map((m) => (
            <span
              key={m}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(m / top) * 100}%` }}
            >
              {m / 60}h
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-48">
            {ticks.map((m) => (
              <div
                key={m}
                aria-hidden
                className="absolute inset-x-0 border-t border-line"
                style={{ bottom: `${(m / top) * 100}%` }}
              />
            ))}
            {/* Jeden element do wskazywania: mysz wybiera kolumnę po X, klawiatura strzałkami. */}
            <div
              role="group"
              tabIndex={0}
              aria-label={onOpen ? t.daily.keysOpen : t.daily.keys}
              aria-describedby={liveId}
              className={cn(
                'absolute inset-0 rounded-sm outline-offset-4',
                onOpen && 'cursor-pointer',
              )}
              onClick={(e) => {
                // Kolumna pod kursorem (także przy dotyku, gdzie nie ma najechania).
                const box = e.currentTarget.getBoundingClientRect()
                const i = Math.floor(
                  ((e.clientX - box.left) / box.width) * buckets.length,
                )
                const b = buckets[Math.min(buckets.length - 1, Math.max(0, i))]
                if (onOpen && b && b.minutes > 0)
                  onOpen({ from: b.from, to: b.to, unit })
              }}
              onPointerMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect()
                const i = Math.floor(
                  ((e.clientX - box.left) / box.width) * buckets.length,
                )
                setActive(Math.min(buckets.length - 1, Math.max(0, i)))
              }}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive((v) => v ?? lastWithData)}
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                const step =
                  e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                const b = active !== null ? buckets[active] : undefined
                if ((e.key === 'Enter' || e.key === ' ') && onOpen && b) {
                  e.preventDefault()
                  onOpen({ from: b.from, to: b.to, unit })
                  return
                }
                if (e.key === 'Home') setActive(0)
                else if (e.key === 'End') setActive(buckets.length - 1)
                else if (step)
                  setActive((v) =>
                    Math.min(
                      buckets.length - 1,
                      Math.max(0, (v ?? lastWithData) + step),
                    ),
                  )
                else return
                e.preventDefault()
              }}
            >
              <ol
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-end justify-around"
              >
                {buckets.map((b, i) => (
                  <li
                    key={b.from}
                    className={cn(
                      'flex h-full min-w-0 flex-1 justify-center',
                      active === i && 'bg-muted/70',
                    )}
                  >
                    <span className="flex h-full w-full max-w-6 flex-col-reverse items-stretch px-px">
                      {used.map((x) =>
                        b.byType[x.id] ? (
                          <span
                            key={x.id}
                            className="block border-t-2 border-surface first:border-t-0 last:rounded-t-[4px]"
                            style={{
                              height: `${(b.byType[x.id]! / top) * 100}%`,
                              background: x.color,
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
                      ? t.daily.openDay
                      : t.daily.openWeek
                    : undefined
                }
              />
            )}
          </div>
          <div
            aria-hidden
            className="mt-1.5 flex justify-around text-xs text-ink-soft tabular-nums"
          >
            {buckets.map((b, i) => (
              <span key={b.from} className="min-w-0 flex-1 text-center">
                {i % every === 0 ? short(b) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

/**
 * Kiedy pracujesz: siatka dzień tygodnia × godzina, jeden odcień od jasnego do ciemnego.
 * Tylko wpisy z godzinami od–do.
 */
export function HourHeatmap({
  entries,
  className,
}: {
  entries: ReadonlyArray<TimeEntry>
  className?: string
}) {
  const t = useMessages(reportsMessages).charts
  const format = useFormat()
  const { locale } = useI18n()
  const map = hourHeatmap(entries)
  const hours = Array.from(
    { length: map.lastHour - map.firstHour + 1 },
    (_, i) => map.firstHour + i,
  )
  // 2026-11-16 to poniedziałek: z niego bierzemy nazwy dni w języku użytkownika.
  const days = Array.from({ length: 7 }, (_, i) =>
    formatDate(locale, `2026-11-${16 + i}`, { weekday: 'short' }),
  )
  const level = (m: number) =>
    m === 0 ? 0 : Math.min(4, Math.ceil((m / Math.max(1, map.max)) * 4))
  const SHADES = ['var(--muted)', '18%', '40%', '68%', '100%']
  const fill = (lvl: number) =>
    lvl === 0
      ? SHADES[0]
      : `color-mix(in oklab, var(--wt-task) ${SHADES[lvl]}, var(--surface))`

  if (map.max === 0)
    return (
      <ChartCard
        title={t.hours.title}
        lead={t.hours.lead}
        className={className}
      >
        <p className="text-sm text-ink-soft">{t.hours.empty}</p>
      </ChartCard>
    )

  return (
    <ChartCard
      className={className}
      title={t.hours.title}
      lead={t.hours.lead}
      legend={
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          {t.hours.less}
          {[1, 2, 3, 4].map((l) => (
            <span
              key={l}
              aria-hidden
              className="size-3 rounded-[3px]"
              style={{ background: fill(l) }}
            />
          ))}
          {t.hours.more}
        </div>
      }
    >
      <div
        tabIndex={0}
        role="region"
        aria-label={t.hours.title}
        className="overflow-x-auto rounded-sm"
      >
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="font-normal text-ink-soft tabular-nums"
                >
                  {h % 2 === 0 || hours.length < 10 ? h : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {map.cells.map((row, d) => (
              <tr key={d}>
                <th
                  scope="row"
                  className="pr-1 text-left font-normal text-ink-soft"
                >
                  {days[d]}
                </th>
                {hours.map((h) => {
                  const m = row[h]!
                  const text = fmt(t.hours.cell, {
                    day: days[d]!,
                    hour: `${h}:00–${h + 1}:00`,
                    time: format.minutes(m),
                  })
                  return (
                    <td
                      key={h}
                      title={text}
                      className="h-6 min-w-5 rounded-[3px]"
                      style={{ background: fill(level(m)) }}
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

/** Trafność estymat: o ile zadania wyszły ponad (w prawo) albo poniżej (w lewo) estymaty. */
export function EstimateChart({ rows }: { rows: ReadonlyArray<TaskRow> }) {
  const t = useMessages(reportsMessages).charts
  const format = useFormat()
  const misses = estimateMisses(rows)
  if (misses.length === 0)
    return (
      <ChartCard title={t.estimates.title} lead={t.estimates.lead}>
        <p className="text-sm text-ink-soft">{t.estimates.empty}</p>
      </ChartCard>
    )
  const scale = Math.max(...misses.map((m) => Math.abs(m.diff)), 1)
  return (
    <ChartCard
      title={t.estimates.title}
      lead={t.estimates.lead}
      legend={
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px] bg-[var(--wt-pair)]"
            />
            {t.estimates.under}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-wt-review" />
            {t.estimates.over}
          </li>
        </ul>
      }
    >
      <ul className="space-y-3">
        {misses.map((m) => {
          const width = (Math.abs(m.diff) / scale) * 50
          const value =
            m.diff === 0
              ? t.estimates.exact
              : `${m.diff > 0 ? '+' : '−'}${format.minutes(Math.abs(m.diff))}`
          return (
            <li key={m.key}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{m.title}</span>
                <span className="shrink-0 text-ink-soft tabular-nums">
                  {fmt(t.estimates.row, {
                    time: format.minutes(m.minutes),
                    estimate: format.minutes(m.estimate),
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
                      m.diff > 0
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
          {t.estimates.few}
        </p>
      )}
    </ChartCard>
  )
}

/** Jedna seria w kolumnach (np. SP na sprint): wartość nad kolumną, dymek przy fokusie. */
export function ColumnChart({
  title,
  lead,
  items,
  color = 'var(--wt-task)',
}: {
  title: string
  lead?: string
  items: Array<{ key: string; label: string; value: number; display: string }>
  color?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ChartCard title={title} lead={lead}>
      <ol className="flex h-40 items-end justify-around gap-1 border-b border-line">
        {items.map((i) => (
          <li
            key={i.key}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            aria-label={`${i.label}: ${i.display}`}
          >
            <span className="mb-1 text-xs font-semibold tabular-nums">
              {i.display}
            </span>
            <span
              aria-hidden
              className="block w-full max-w-6 rounded-t-[4px]"
              style={{
                height: `${(i.value / max) * 80}%`,
                minHeight: i.value > 0 ? 2 : 0,
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
        {items.map((i) => (
          <span key={i.key} className="min-w-0 flex-1 truncate text-center">
            {i.label}
          </span>
        ))}
      </div>
    </ChartCard>
  )
}
