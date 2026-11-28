import {
  useDismissPaused,
  useElapsed,
  usePauseTimer,
  useResumeTask,
  useStopTimer,
} from '../controllers/use-timer'
import { entriesQuery, pausedQuery, runningQuery } from '../data/queries'
import { formatClock } from '../domain/clock'
import { BreakBar } from './breaks'
import { EditEntryDialog } from './edit-entry-dialog'
import { useTaskProgress } from '../controllers/use-task-progress'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { useStartBreak } from '#/features/breaks/controllers/use-breaks'
import { runningBreakQuery } from '#/features/breaks/data/queries'
import { taskGroupKey } from '#/features/reports/domain/report'
import { settingsQuery } from '#/features/settings/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'
import { todayIn } from '#/shared/domain/dates'
import { Check, Coffee, Pause, Pencil, Play, Square } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Pasek timera na każdej stronie panelu. Gdy timer działa: licznik, „Wstrzymaj” i „Stop”,
 * a obok wstrzymane zadania do szybkiego powrotu. Gdy nic nie działa: lista wstrzymanych z „Wznów”.
 * Licznik ma role="timer" (czytniki nie ogłaszają każdej sekundy), a tytuł karty pokazuje czas.
 */
export function TimerBar() {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const running = useQuery(runningQuery).data
  const paused = useQuery(pausedQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const type = types.find((workType) => workType.id === running?.taskTypeId)
  const seconds = useElapsed(running)
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTask()
  const runningBreak = useQuery(runningBreakQuery).data
  const startBreak = useStartBreak()
  const [editing, setEditing] = useState(false)
  const busy =
    stop.isPending ||
    pause.isPending ||
    resume.isPending ||
    startBreak.isPending

  useEffect(() => {
    if (!running) return
    const base = document.title.replace(/^● [\d:]+ · /, '')
    document.title = `● ${formatClock(seconds)} · ${base}`
    return () => {
      document.title = document.title.replace(/^● [\d:]+ · /, '')
    }
  }, [running, seconds])

  // Trwająca przerwa ma pierwszeństwo: timer zadania jest na jej czas wstrzymany.
  if (runningBreak) return <BreakBar running={runningBreak} />
  if (!running) return paused.length > 0 ? <PausedBar paused={paused} /> : null

  const waiting = paused.filter(
    (pausedEntry) => taskGroupKey(pausedEntry) !== taskGroupKey(running),
  )
  return (
    <section
      aria-label={messages.timer.running}
      className="sticky top-0 z-20 border-b border-white/10 bg-[var(--ink-fixed)] text-white"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 md:px-10">
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span
            className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
            style={{ background: type?.color ?? '#fff' }}
          />
          <span
            className="relative inline-flex size-2.5 rounded-full"
            style={{ background: type?.color ?? '#fff' }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={messages.timer.edit}
            aria-label={fmt(messages.timer.editNamed, { name: running.title })}
            className="group/title -mx-1 flex max-w-full items-center gap-1.5 rounded px-1 text-left text-sm font-semibold hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <span className="truncate">{running.title}</span>
            <Pencil
              aria-hidden
              className="size-3.5 shrink-0 opacity-60 group-hover/title:opacity-100"
            />
          </button>
          <p className="truncate text-xs text-white/70">
            {type?.name}
            {running.startTime &&
              ` · ${fmt(messages.timer.since, { time: format.time(running.startTime) })}`}
            <RunningProgress entry={running} />
          </p>
        </div>
        <span
          role="timer"
          aria-label={fmt(messages.timer.elapsed, {
            time: formatClock(seconds),
          })}
          className="font-mono text-lg font-semibold tabular-nums sm:text-xl"
        >
          {formatClock(seconds)}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => startBreak.mutate()}
            disabled={busy}
            className="h-10 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white"
          >
            <Coffee aria-hidden className="size-3.5" />
            {messages.breaks.start}
          </Button>
          <Button
            variant="outline"
            onClick={() => pause.mutate(running.id)}
            disabled={busy}
            className="h-10 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white"
          >
            <Pause aria-hidden className="size-3.5" fill="currentColor" />
            {messages.timer.pause}
            <span className="sr-only">: {running.title}</span>
          </Button>
          <Button
            onClick={() => stop.mutate(running.id)}
            disabled={busy}
            className={cn(
              'h-10 bg-white px-4 text-[var(--ink-fixed)] hover:bg-white/90',
            )}
          >
            <Square aria-hidden className="size-3.5" fill="currentColor" />
            {messages.timer.stop}
            <span className="sr-only">: {running.title}</span>
          </Button>
        </div>
        {waiting.length > 0 && (
          <ul
            aria-label={messages.timer.pausedRegion}
            className="flex w-full flex-wrap items-center gap-2 border-t border-white/10 pt-2 text-xs"
          >
            <li aria-hidden className="text-white/60">
              {messages.timer.paused}:
            </li>
            {waiting.slice(0, 3).map((pausedEntry) => (
              <li key={pausedEntry.id} className="min-w-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resume.mutate(pausedEntry.id)}
                  className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
                >
                  <Play aria-hidden className="size-3" fill="currentColor" />
                  <span className="truncate">{pausedEntry.title}</span>
                  <span className="sr-only">: {messages.timer.resume}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && (
        <EditEntryDialog entry={running} onClose={() => setEditing(false)} />
      )}
    </section>
  )
}

interface PausedBarProps {
  paused: Array<TimeEntry>
}

/** Nic nie działa, ale są wstrzymane zadania: „Wznów” albo „Gotowe” jednym kliknięciem. */
function PausedBar({ paused }: PausedBarProps) {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const timeZone = useQuery(settingsQuery).data?.timezone
  const today = useQuery(entriesQuery(todayIn(timeZone))).data ?? []
  const resume = useResumeTask()
  const dismiss = useDismissPaused()
  const busy = resume.isPending || dismiss.isPending

  return (
    <section
      aria-label={messages.timer.pausedRegion}
      className="sticky top-0 z-20 border-b border-line bg-surface"
    >
      <ul className="mx-auto flex max-w-6xl flex-col divide-y divide-line px-4 sm:px-6 md:px-10">
        {paused.slice(0, 3).map((timeEntry) => {
          const type = types.find(
            (workType) => workType.id === timeEntry.taskTypeId,
          )
          const minutes = today
            .filter((entry) => taskGroupKey(entry) === taskGroupKey(timeEntry))
            .reduce((sum, entry) => sum + entry.durationMinutes, 0)
          return (
            <li
              key={timeEntry.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2"
            >
              <Pause
                aria-hidden
                className="size-3.5 shrink-0"
                style={{ color: type?.color }}
                fill="currentColor"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {timeEntry.title}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {messages.timer.paused} · {type?.name} ·{' '}
                  {fmt(messages.timer.todayTotal, {
                    time: format.minutes(minutes),
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => resume.mutate(timeEntry.id)}
                >
                  <Play aria-hidden className="size-3.5" fill="currentColor" />
                  {messages.timer.resume}
                  <span className="sr-only">: {timeEntry.title}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => dismiss.mutate(timeEntry)}
                >
                  <Check aria-hidden className="size-3.5" />
                  {messages.timer.done}
                  <span className="sr-only">: {timeEntry.title}</span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface RunningProgressProps {
  entry: TimeEntry
}

/** „≈ 1,9 z 5 SP” na pasku timera: ile zadania już zrobione wg przepracowanego czasu. */
function RunningProgress({ entry }: RunningProgressProps) {
  const messages = useMessages(entriesMessages).progress
  const format = useFormat()
  const taskProgress = useTaskProgress(entry)
  if (!taskProgress) return null
  return (
    <>
      {' · '}
      <span className="font-semibold text-white">
        {fmt(messages.short, {
          earned: format.number(taskProgress.earned),
          sp: format.sp(taskProgress.sp),
        })}
      </span>
    </>
  )
}
