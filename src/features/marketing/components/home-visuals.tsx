import { Check, Download } from 'lucide-react'
import { workKindColors } from '#/config/work-types'
import type { WorkKind } from '#/config/work-types'
import { useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { homeMessages } from '#/i18n/messages/home'

const card =
  'rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-40px_rgba(20,22,43,0.45)]'
const shares = [38, 17, 11, 9, 5]

/**
 * Hero: jedna animacja na całej stronie. Szary blok „Programowanie, 80 h” (tak widzi sprint zwykły
 * tracker) rozpada się na typy pracy, a pod nim pojawiają się liczby. Czysty CSS (styles.css → split-*),
 * bez JavaScriptu; przy „ogranicz ruch” od razu widać stan końcowy. Czytniki dostają jeden opis.
 */
export function SprintSplit() {
  const t = useMessages(homeMessages).split
  const types = useMessages(commonMessages).workTypes
  return (
    <div
      role="img"
      aria-label={t.label}
      className={`${card} select-none p-6 sm:p-8`}
    >
      <div aria-hidden>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-heading text-2xl">{t.sprint}</p>
          <p className="text-sm text-ink-soft">{t.total}</p>
        </div>

        <div className="relative mt-5">
          <div className="split-bar flex h-14 gap-1 overflow-hidden rounded-2xl">
            {t.rows.map((row, i) => (
              <span
                key={row.kind}
                className="split-segment h-full"
                style={{
                  flex: shares[i],
                  background: workKindColors[row.kind as WorkKind].color,
                  animationDelay: `${900 + i * 70}ms`,
                }}
              />
            ))}
          </div>
          <p className="split-before pointer-events-none absolute inset-0 flex items-center px-5 font-semibold text-white">
            {t.before}
          </p>
        </div>

        <ul className="mt-6 space-y-2.5">
          {t.rows.map((row, i) => (
            <li
              key={row.kind}
              className="split-row flex items-center gap-3"
              style={{ animationDelay: `${1500 + i * 90}ms` }}
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{
                  background: workKindColors[row.kind as WorkKind].color,
                }}
              />
              <span className="flex-1">{types[row.kind as WorkKind]}</span>
              <span className="font-semibold tabular-nums">{row.hours}</span>
              <span className="w-11 text-right text-ink-soft tabular-nums">
                {row.share}
              </span>
            </li>
          ))}
        </ul>

        <p
          className="split-row mt-6 flex items-baseline gap-3 border-t border-line pt-5"
          style={{ animationDelay: '2100ms' }}
        >
          <span className="type-display text-5xl">{t.perSp}</span>
          <span className="text-ink-soft">{t.perSpLabel}</span>
        </p>
      </div>
    </div>
  )
}

/** Przerwane zadanie na osi czasu: dwa odcinki PAY-142 i hotfix pomiędzy nimi. */
export function IntervalsVisual() {
  const t = useMessages(homeMessages).intervals
  const task = workKindColors.task.color
  const extra = workKindColors.additional_work.color
  // 6:40–10:00 = 200 minut; szerokości w procentach osi.
  const blocks = [
    { width: 20, color: task },
    { width: 45, color: extra },
    { width: 5, color: 'transparent' },
    { width: 30, color: task },
  ]
  const ticks = [0, 20, 65, 70, 100]
  return (
    <div
      role="img"
      aria-label={t.label}
      className={`${card} select-none p-6 sm:p-8`}
    >
      <div aria-hidden>
        <div className="relative pt-7">
          <span className="absolute top-0 left-[20%] -translate-x-1/2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
            {t.paused}
          </span>
          <span className="absolute top-0 left-[70%] -translate-x-1/2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
            {t.resumed}
          </span>
          <div className="flex h-12 overflow-hidden rounded-xl bg-muted">
            {blocks.map((b, i) => (
              <span
                key={i}
                className="h-full border-r-2 border-surface last:border-r-0"
                style={{ width: `${b.width}%`, background: b.color }}
              />
            ))}
          </div>
          <div className="relative mt-2 h-5 text-xs text-ink-soft tabular-nums">
            {ticks.map((left, i) => (
              <span
                key={left}
                className="absolute"
                style={{
                  left: `${left}%`,
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticks.length - 1
                        ? 'translateX(-100%)'
                        : i === 2
                          ? 'translateX(-100%)'
                          : i === 3
                            ? 'none'
                            : 'translateX(-50%)',
                }}
              >
                {t.times[i]}
              </span>
            ))}
          </div>
        </div>
        <ul className="mt-6 space-y-3">
          <li className="flex items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: task }}
            />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {t.task}
            </span>
            <span className="text-sm text-ink-soft">{t.taskTotal}</span>
          </li>
          <li className="flex items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: extra }}
            />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {t.hotfix}
            </span>
            <span className="text-sm text-ink-soft">{t.hotfixTotal}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

/** Raport per ticket z eksportem CSV: to, co dostaje klient albo review sprintu. */
export function TimesheetVisual() {
  const t = useMessages(homeMessages).timesheet
  return (
    <div
      role="img"
      aria-label={t.label}
      className={`${card} select-none p-6 sm:p-8`}
    >
      <div aria-hidden>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="type-heading text-2xl">{t.month}</p>
            <p className="text-sm text-ink-soft">{t.by}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-fixed)] px-3.5 py-2 text-sm font-semibold text-white">
            <Download className="size-4" />
            {t.export}
          </span>
        </div>
        <div className="mt-5 text-[0.9375rem]">
          <div className="grid grid-cols-[1fr_3rem_4.5rem] gap-3 pb-2 text-sm text-ink-soft">
            <span>{t.ticket}</span>
            <span className="text-right">{t.sp}</span>
            <span className="text-right">{t.hours}</span>
          </div>
          {t.rows.map(([name, sp, hours]) => (
            <div
              key={name}
              className="grid grid-cols-[1fr_3rem_4.5rem] gap-3 border-t border-line py-2.5"
            >
              <span className="truncate">{name}</span>
              <span className="text-right tabular-nums">{sp}</span>
              <span className="text-right tabular-nums">{hours}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_7.5rem] gap-3 border-t-2 border-ink pt-3 font-semibold">
            <span>{t.total}</span>
            <span className="text-right tabular-nums">{t.totalHours}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface ChecksProps {
  items: ReadonlyArray<string>
}

/** Lista korzyści z zielonym znacznikiem (tekst niesie treść, ikona jest ozdobą). */
export function Checks({ items }: ChecksProps) {
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <Check aria-hidden className="mt-1 size-4 shrink-0 text-wt-pair" />
          {item}
        </li>
      ))}
    </ul>
  )
}
