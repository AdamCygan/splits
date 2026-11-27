import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, Plus, RotateCcw } from 'lucide-react'
import { TickingTime } from '#/components/brand/ticking-time'
import {
  workKindColors,
  workKindOrder,
} from '#/features/task-types/domain/work-types'
import type { WorkKind } from '#/features/task-types/domain/work-types'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { marketingMessages } from '#/i18n/messages/marketing'
import type { MarketingMessages } from '#/i18n/messages/marketing'

/**
 * Interaktywne demo w hero: jeden dzień pracy na osi 9:00–17:00.
 * Szybkie szablony dopisują wpisy, timer można zatrzymać — sumy liczą się na żywo.
 */

const DAY_START = 9 * 60
const DAY_LENGTH = 8 * 60
const DAY_TARGET = 8 * 60

type TitleKey = keyof MarketingMessages['demo']['titles']

interface DemoEntry {
  id: string
  kind: WorkKind
  title: TitleKey
  start: number // minuty od 9:00
  duration: number
  storyPoints: number
  taskKey?: string // ten sam klucz = to samo zadanie (SP liczone raz)
}

const initialEntries: Array<DemoEntry> = [
  {
    id: 'e1',
    kind: 'meeting',
    title: 'standup',
    start: 0,
    duration: 15,
    storyPoints: 0.5,
  },
  {
    id: 'e2',
    kind: 'task',
    title: 'payment',
    start: 15,
    duration: 130,
    storyPoints: 3,
    taskKey: 'PAY-142',
  },
  {
    id: 'e3',
    kind: 'code_review',
    title: 'cr481',
    start: 145,
    duration: 25,
    storyPoints: 0.5,
  },
  {
    id: 'e4',
    kind: 'pair_programming',
    title: 'pair',
    start: 210,
    duration: 60,
    storyPoints: 1,
  },
  {
    id: 'e5',
    kind: 'additional_work',
    title: 'hotfix',
    start: 270,
    duration: 40,
    storyPoints: 0.5,
  },
]

const templates: Array<{
  kind: WorkKind
  title: TitleKey
  duration: number
  storyPoints: number
}> = [
  { kind: 'code_review', title: 'cr486', duration: 25, storyPoints: 0.5 },
  { kind: 'meeting', title: 'refinement', duration: 30, storyPoints: 0.5 },
  { kind: 'pair_programming', title: 'e2e', duration: 60, storyPoints: 1 },
]

const TIMER_TASK = {
  title: 'payment' as TitleKey,
  taskKey: 'PAY-142',
  storyPoints: 3,
}

/** Stała data demo (wtorek), sformatowana w języku użytkownika. */
const DEMO_DATE = new Date(Date.UTC(2025, 10, 4, 12))
const TIMER_START_SECONDS = 42 * 60 + 13

let idCounter = 0
const newId = () => `demo-${++idCounter}`

const clock = (minutesFromStart: number) => {
  const total = DAY_START + minutesFromStart
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function DayStripDemo() {
  const t = useMessages(marketingMessages).demo
  const workTypes = useMessages(commonMessages).workTypes
  const format = useFormat()
  const { tag } = useI18n()
  const dateLabel = DEMO_DATE.toLocaleDateString(tag, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const [entries, setEntries] = useState(initialEntries)
  const [timerRunning, setTimerRunning] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(TIMER_START_SECONDS)

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => setTimerSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

  const cursor = entries.reduce(
    (end, e) => Math.max(end, e.start + e.duration),
    0,
  )
  const runningMinutes = timerRunning ? Math.floor(timerSeconds / 60) : 0
  const freeMinutes = DAY_LENGTH - cursor - runningMinutes

  const summary = useMemo(() => {
    const byKind = new Map<WorkKind, number>()
    const counted = new Set<string>()
    let points = 0
    for (const e of entries) {
      byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + e.duration)
      const key = e.taskKey ?? e.id
      if (!counted.has(key)) {
        counted.add(key)
        points += e.storyPoints
      }
    }
    if (timerRunning) {
      byKind.set('task', (byKind.get('task') ?? 0) + runningMinutes)
      if (!counted.has(TIMER_TASK.taskKey)) points += TIMER_TASK.storyPoints
    }
    const total = [...byKind.values()].reduce((a, b) => a + b, 0)
    return { byKind, points, total }
  }, [entries, timerRunning, runningMinutes])

  const addTemplate = (tpl: (typeof templates)[number]) => {
    if (freeMinutes < tpl.duration) return
    setEntries((prev) => [
      ...prev,
      {
        id: newId(),
        kind: tpl.kind,
        title: tpl.title,
        start: cursor,
        duration: tpl.duration,
        storyPoints: tpl.storyPoints,
      },
    ])
  }

  const toggleTimer = () => {
    if (timerRunning) {
      const minutes = Math.max(1, Math.floor(timerSeconds / 60))
      setEntries((prev) => [
        ...prev,
        {
          id: newId(),
          kind: 'task',
          title: TIMER_TASK.title,
          start: cursor,
          duration: Math.min(minutes, DAY_LENGTH - cursor),
          storyPoints: TIMER_TASK.storyPoints,
          taskKey: TIMER_TASK.taskKey,
        },
      ])
      setTimerRunning(false)
    } else {
      setTimerSeconds(0)
      setTimerRunning(true)
    }
  }

  const reset = () => {
    setEntries(initialEntries)
    setTimerSeconds(TIMER_START_SECONDS)
    setTimerRunning(true)
  }

  const progress = Math.min(1, summary.total / DAY_TARGET)

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_0_var(--line),0_24px_60px_-28px_rgba(20,22,43,0.28)]">
      {/* Nagłówek dnia */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line px-5 pt-5 pb-4 sm:px-7">
        <div>
          <p className="text-sm text-ink-soft first-letter:uppercase">
            {dateLabel}
          </p>
          <p className="type-heading text-2xl">{t.yourDay}</p>
        </div>
        <div className="min-w-56 flex-1 sm:max-w-72">
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">{t.logged}</span>
            <span className="font-semibold">
              {fmt(t.ofTarget, {
                logged: format.minutes(summary.total),
                target: format.minutes(DAY_TARGET),
              })}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Oś dnia */}
      <div className="px-5 pt-6 sm:px-7">
        <div
          className="relative h-14 overflow-hidden rounded-lg bg-[repeating-linear-gradient(90deg,var(--muted)_0,var(--muted)_calc(12.5%-1px),var(--line)_calc(12.5%-1px),var(--line)_12.5%)]"
          role="img"
          aria-label={fmt(t.timelineLabel, {
            count: format.plural(t.entries, entries.length),
            total: format.minutes(summary.total),
          })}
        >
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="strip-block absolute inset-y-0 border-r-2 border-surface"
              style={{
                left: `${(e.start / DAY_LENGTH) * 100}%`,
                width: `${(e.duration / DAY_LENGTH) * 100}%`,
                background: workKindColors[e.kind].color,
                animationDelay:
                  i < initialEntries.length ? `${150 + i * 110}ms` : '0ms',
              }}
              title={`${clock(e.start)}–${clock(e.start + e.duration)} ${t.titles[e.title]}`}
            />
          ))}
          {timerRunning && runningMinutes > 0 && (
            <div
              className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--wt-task)_0,var(--wt-task)_6px,color-mix(in_oklab,var(--wt-task)_70%,white)_6px,color-mix(in_oklab,var(--wt-task)_70%,white)_12px)]"
              style={{
                left: `${(cursor / DAY_LENGTH) * 100}%`,
                width: `${(Math.min(runningMinutes, DAY_LENGTH - cursor) / DAY_LENGTH) * 100}%`,
              }}
            />
          )}
        </div>
        <div
          className="mt-1.5 flex justify-between text-xs text-ink-faint"
          aria-hidden
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="w-0 text-center first:text-left last:text-right"
            >
              <span className="inline-block -translate-x-1/2 first:translate-x-0">
                {9 + i}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-5 pt-5 pb-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Timer + szablony */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl bg-ink px-4 py-3 text-white">
            <button
              type="button"
              onClick={toggleTimer}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink transition-transform active:scale-95"
              aria-label={timerRunning ? t.stopTimer : t.startTimer}
            >
              {timerRunning ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 translate-x-px" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/70">
                {timerRunning ? t.timerRunning : t.timerStopped}
              </p>
              <p className="truncate font-medium">
                {t.titles[TIMER_TASK.title]}
              </p>
            </div>
            <TickingTime
              seconds={timerSeconds}
              className="text-2xl font-semibold"
            />
          </div>

          <div>
            <p className="mb-2 text-sm text-ink-soft">{t.templatesHint}</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.title}
                  type="button"
                  onClick={() => addTemplate(tpl)}
                  disabled={freeMinutes < tpl.duration}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-2 text-sm font-medium transition-colors hover:border-ink-faint disabled:opacity-40"
                >
                  <span
                    className="grid size-5 place-items-center rounded-full"
                    style={{
                      background: workKindColors[tpl.kind].color,
                      color: workKindColors[tpl.kind].ink,
                    }}
                  >
                    <Plus className="size-3" strokeWidth={3} />
                  </span>
                  {workTypes[tpl.kind]}, {format.minutes(tpl.duration)}
                </button>
              ))}
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
              >
                <RotateCcw className="size-3.5" />
                {t.clear}
              </button>
            </div>
            {freeMinutes < 25 && (
              <p className="mt-2 text-sm text-ink-soft" role="status">
                {t.dayFull}
              </p>
            )}
          </div>

          <ol className="max-h-56 divide-y divide-line overflow-y-auto pr-1 text-sm">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: workKindColors[e.kind].color }}
                />
                <span className="w-24 shrink-0 text-ink-faint tabular-nums">
                  {clock(e.start)}–{clock(e.start + e.duration)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t.titles[e.title]}
                </span>
                <span className="shrink-0 text-ink-soft">
                  {format.minutes(e.duration)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Podsumowanie dnia */}
        <aside
          className="rounded-xl border border-line p-4"
          aria-label={t.summary}
        >
          <p className="text-sm text-ink-soft">{t.spToday}</p>
          <p className="type-heading text-4xl">{format.sp(summary.points)}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {workKindOrder
              .filter((k) => (summary.byKind.get(k) ?? 0) > 0)
              .map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: workKindColors[k].color }}
                  />
                  <span className="flex-1">{workTypes[k]}</span>
                  <span className="font-medium">
                    {format.minutes(summary.byKind.get(k) ?? 0)}
                  </span>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
