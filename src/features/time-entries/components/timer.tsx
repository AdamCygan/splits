import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Coffee, Pause, Pencil, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { data } from '#/data'
import type { TimeEntry } from '#/data/types'
import { elapsedSeconds } from '#/domain/entries'
import { todayIn } from '#/domain/dates'
import { taskGroupKey } from '#/domain/report'
import {
  settingsQuery,
  taskTypesQuery,
  useDataMutation,
} from '#/features/settings/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'
import {
  entriesQuery,
  entryKeys,
  pausedQuery,
  runningBreakQuery,
  runningQuery,
} from '../queries'
import { BreakBar, useStartBreak } from './breaks'
import { EditEntryDialog } from './edit-entry-dialog'
import { useTaskProgress } from './task-progress'

/** Licznik sekund od startu, odświeżany co sekundę tylko gdy timer działa. */
export function useElapsed(entry: TimeEntry | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  const active = Boolean(entry?.running)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return entry?.running ? elapsedSeconds(entry.startedAt, now) : 0
}

export const formatClock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
    .join(':')

/** Zatrzymanie timera z komunikatem o zalogowanym czasie. */
export function useStopTimer() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => data.entries.stop(id), {
    invalidate: [entryKeys.all],
    success: (stopped) =>
      fmt(t.timer.stopped, { time: format.minutes(stopped.durationMinutes) }),
  })
}

/** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
export function usePauseTimer() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => data.entries.pause(id), {
    invalidate: [entryKeys.all],
    success: (paused) =>
      fmt(t.timer.pausedDone, {
        name: paused.title,
        time: format.minutes(paused.durationMinutes),
      }),
  })
}

/** Wznowienie zadania (nowy odcinek czasu); działający timer innego zadania zostaje wstrzymany. */
export function useResumeTask() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => data.entries.resume(id), {
    invalidate: [entryKeys.all],
    success: (result) => fmt(t.timer.resumed, { name: result.started.title }),
    onSuccess: (result) => {
      if (result.stopped)
        toast(
          fmt(t.form.previousStopped, {
            name: result.stopped.title,
            time: format.minutes(result.stopped.durationMinutes),
          }),
        )
    },
  })
}

/** Zadanie skończone: znika z listy wstrzymanych. */
export function useDismissPaused() {
  const t = useMessages(entriesMessages)
  return useDataMutation((entry: TimeEntry) => data.entries.dismiss(entry.id), {
    invalidate: [entryKeys.all],
    success: (_, entry) => fmt(t.timer.dismissed, { name: entry.title }),
  })
}

export const clockTime = (tag: string, time: string) =>
  new Intl.DateTimeFormat(tag, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`1970-01-01T${time}:00Z`))

/**
 * Pasek timera na każdej stronie panelu. Gdy timer działa: licznik, „Wstrzymaj” i „Stop”,
 * a obok wstrzymane zadania do szybkiego powrotu. Gdy nic nie działa: lista wstrzymanych z „Wznów”.
 * Licznik ma role="timer" (czytniki nie ogłaszają każdej sekundy), a tytuł karty pokazuje czas.
 */
export function TimerBar() {
  const t = useMessages(entriesMessages)
  const { tag } = useI18n()
  const running = useQuery(runningQuery).data
  const paused = useQuery(pausedQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const type = types.find((x) => x.id === running?.taskTypeId)
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
    (p) => taskGroupKey(p) !== taskGroupKey(running),
  )
  return (
    <section
      aria-label={t.timer.running}
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
            title={t.timer.edit}
            aria-label={fmt(t.timer.editNamed, { name: running.title })}
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
              ` · ${fmt(t.timer.since, { time: clockTime(tag, running.startTime) })}`}
            <RunningProgress entry={running} />
          </p>
        </div>
        <span
          role="timer"
          aria-label={fmt(t.timer.elapsed, { time: formatClock(seconds) })}
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
            {t.breaks.start}
          </Button>
          <Button
            variant="outline"
            onClick={() => pause.mutate(running.id)}
            disabled={busy}
            className="h-10 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white"
          >
            <Pause aria-hidden className="size-3.5" fill="currentColor" />
            {t.timer.pause}
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
            {t.timer.stop}
            <span className="sr-only">: {running.title}</span>
          </Button>
        </div>
        {waiting.length > 0 && (
          <ul
            aria-label={t.timer.pausedRegion}
            className="flex w-full flex-wrap items-center gap-2 border-t border-white/10 pt-2 text-xs"
          >
            <li aria-hidden className="text-white/60">
              {t.timer.paused}:
            </li>
            {waiting.slice(0, 3).map((p) => (
              <li key={p.id} className="min-w-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resume.mutate(p.id)}
                  className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
                >
                  <Play aria-hidden className="size-3" fill="currentColor" />
                  <span className="truncate">{p.title}</span>
                  <span className="sr-only">: {t.timer.resume}</span>
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

/** Nic nie działa, ale są wstrzymane zadania: „Wznów” albo „Gotowe” jednym kliknięciem. */
function PausedBar({ paused }: { paused: Array<TimeEntry> }) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const timeZone = useQuery(settingsQuery).data?.timezone
  const today = useQuery(entriesQuery(todayIn(timeZone))).data ?? []
  const resume = useResumeTask()
  const dismiss = useDismissPaused()
  const busy = resume.isPending || dismiss.isPending

  return (
    <section
      aria-label={t.timer.pausedRegion}
      className="sticky top-0 z-20 border-b border-line bg-surface"
    >
      <ul className="mx-auto flex max-w-6xl flex-col divide-y divide-line px-4 sm:px-6 md:px-10">
        {paused.slice(0, 3).map((p) => {
          const type = types.find((x) => x.id === p.taskTypeId)
          const minutes = today
            .filter((e) => taskGroupKey(e) === taskGroupKey(p))
            .reduce((sum, e) => sum + e.durationMinutes, 0)
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2"
            >
              <Pause
                aria-hidden
                className="size-3.5 shrink-0"
                style={{ color: type?.color }}
                fill="currentColor"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="truncate text-xs text-ink-soft">
                  {t.timer.paused} · {type?.name} ·{' '}
                  {fmt(t.timer.todayTotal, { time: format.minutes(minutes) })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => resume.mutate(p.id)}
                >
                  <Play aria-hidden className="size-3.5" fill="currentColor" />
                  {t.timer.resume}
                  <span className="sr-only">: {p.title}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => dismiss.mutate(p)}
                >
                  <Check aria-hidden className="size-3.5" />
                  {t.timer.done}
                  <span className="sr-only">: {p.title}</span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** „≈ 1,9 z 5 SP” na pasku timera: ile zadania już zrobione wg przepracowanego czasu. */
function RunningProgress({ entry }: { entry: TimeEntry }) {
  const t = useMessages(entriesMessages).progress
  const format = useFormat()
  const p = useTaskProgress(entry)
  if (!p) return null
  return (
    <>
      {' · '}
      <span className="font-semibold text-white">
        {fmt(t.short, { earned: format.number(p.earned), sp: format.sp(p.sp) })}
      </span>
    </>
  )
}
