import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Coffee, List as ListIcon, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { TimeInput } from '#/components/ui/time-input'
import { Input } from '#/components/ui/input'
import { breaksApi } from '#/features/breaks/data/api'
import type { WorkBreak } from '#/features/breaks/data/dto'
import {
  minutesBetween,
  parseDuration,
} from '#/features/time-entries/domain/entries'
import { TIME_RE } from '#/features/task-types/domain/rules'
import { settingsQuery } from '#/features/settings/data/queries'
import { useDataMutation } from '#/shared/data/mutations'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import {
  breakKeys,
  breaksQuery,
  runningBreakQuery,
} from '#/features/breaks/data/queries'
import { entryKeys } from '../data/queries'
import { formatClock } from './timer'
import { ProgressBar } from '#/components/ui/progress-bar'
import { StatTile } from '#/components/ui/stats'

/** Sekundy trwającej przerwy, odświeżane co sekundę. */
function useBreakSeconds(running: WorkBreak | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])
  if (!running?.startedAt) return 0
  return Math.max(0, Math.floor((now - Date.parse(running.startedAt)) / 1000))
}

/** Przerwy z dnia: wykorzystane minuty (z trwającą), limit z ustawień i trwająca przerwa. */
export function useBreakDay(date: string) {
  const list = useQuery(breaksQuery(date)).data ?? []
  const running = useQuery(runningBreakQuery).data ?? null
  const limit = useQuery(settingsQuery).data?.breakMinutes ?? 30
  const seconds = useBreakSeconds(running)
  const finished = list
    .filter((b) => !b.running)
    .reduce((sum, b) => sum + b.durationMinutes, 0)
  const live =
    running && running.workDate === date ? Math.floor(seconds / 60) : 0
  return { list, running, limit, used: finished + live, seconds }
}

export function useStartBreak() {
  const t = useMessages(entriesMessages).breaks
  return useDataMutation(() => breaksApi.start(), {
    invalidate: [breakKeys.all, entryKeys.all],
    success: (result) =>
      result.paused
        ? fmt(t.startedPaused, { name: result.paused.title })
        : t.started,
  })
}

interface EndBreakInput {
  id: string
  /** Po przerwie wznowić wstrzymane zadanie. */
  resume: boolean
}

export function useEndBreak() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation(
    ({ id, resume }: EndBreakInput) => breaksApi.end(id, resume),
    {
      invalidate: [breakKeys.all, entryKeys.all],
      success: (result) =>
        fmt(t.breaks.ended, {
          time: format.minutes(result.break.durationMinutes),
        }),
      onSuccess: (result) => {
        if (result.resumed)
          toast(fmt(t.timer.resumed, { name: result.resumed.title }))
      },
    },
  )
}

export interface BreakBarProps {
  running: WorkBreak
}

/**
 * Pasek trwającej przerwy (zamiast paska timera): licznik, ile zostało z dziennego limitu
 * i „Koniec przerwy”, które od razu wznawia zadanie wstrzymane na jej czas.
 */
export function BreakBar({ running }: BreakBarProps) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const day = useBreakDay(running.workDate)
  const end = useEndBreak()
  const left = day.limit - day.used

  useEffect(() => {
    const base = document.title.replace(/^☕ [\d:]+ · /, '')
    document.title = `☕ ${formatClock(day.seconds)} · ${base}`
    return () => {
      document.title = document.title.replace(/^☕ [\d:]+ · /, '')
    }
  }, [day.seconds])

  return (
    <section
      aria-label={t.breaks.running}
      className="sticky top-0 z-20 border-b border-white/10 bg-[var(--ink-fixed)] text-white"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 md:px-10">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--wt-pair)]"
        >
          <Coffee className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {t.breaks.running}
            {running.startTime &&
              ` · ${fmt(t.breaks.since, { time: format.time(running.startTime) })}`}
          </p>
          {day.limit > 0 && (
            <p className="truncate text-xs text-white/75">
              {left >= 0
                ? fmt(t.breaks.left, { time: format.minutes(left) })
                : fmt(t.breaks.over, { time: format.minutes(-left) })}
            </p>
          )}
        </div>
        <span
          role="timer"
          aria-label={fmt(t.timer.elapsed, { time: formatClock(day.seconds) })}
          className="font-mono text-lg font-semibold tabular-nums sm:text-xl"
        >
          {formatClock(day.seconds)}
        </span>
        <div className="flex shrink-0 flex-wrap gap-2">
          {running.resumeEntryId && (
            <Button
              variant="outline"
              disabled={end.isPending}
              onClick={() => end.mutate({ id: running.id, resume: false })}
              className="h-10 border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white"
            >
              {t.breaks.endOnly}
            </Button>
          )}
          <Button
            disabled={end.isPending}
            onClick={() => end.mutate({ id: running.id, resume: true })}
            className="h-10 bg-white px-4 text-[var(--ink-fixed)] hover:bg-white/90"
          >
            {running.resumeEntryId ? (
              <>
                <Play aria-hidden className="size-3.5" fill="currentColor" />
                {t.breaks.endResume}
              </>
            ) : (
              t.breaks.end
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

export interface BreakTileProps {
  date: string
}

/** Kafelek „Przerwy” na Dziś: ile wykorzystane z limitu, start przerwy i lista. */
export function BreakTile({ date }: BreakTileProps) {
  const t = useMessages(entriesMessages).breaks
  const format = useFormat()
  const day = useBreakDay(date)
  const [open, setOpen] = useState(false)
  const left = day.limit - day.used
  const share = day.limit > 0 ? Math.min(100, (day.used / day.limit) * 100) : 0

  return (
    <StatTile
      label={t.tile}
      action={
        <Button
          size="icon"
          variant="ghost"
          className="-my-1.5 -mr-2 size-8"
          title={t.manage}
          aria-label={t.manage}
          onClick={() => setOpen(true)}
        >
          <ListIcon aria-hidden className="size-4" />
        </Button>
      }
      value={
        day.limit > 0
          ? fmt(t.tileValue, {
              used: format.minutes(day.used),
              limit: format.minutes(day.limit),
            })
          : format.minutes(day.used)
      }
    >
      {day.limit > 0 && (
        <>
          <ProgressBar
            value={share}
            tone={left < 0 ? 'warn' : 'pair'}
            className="mt-2"
          />
          {left < 0 ? (
            <p className="mt-1.5 text-xs font-medium text-ink">
              {fmt(t.tileOver, { time: format.minutes(-left) })}
            </p>
          ) : (
            <p className="sr-only">
              {fmt(t.tileLeft, { time: format.minutes(left) })}
            </p>
          )}
        </>
      )}
      {open && (
        <BreaksDialog date={date} day={day} onClose={() => setOpen(false)} />
      )}
    </StatTile>
  )
}

export interface StartBreakButtonProps {
  date: string
}

/** „Zacznij przerwę” w pasku nad dniem: tylko dziś i gdy przerwa nie trwa. */
export function StartBreakButton({ date }: StartBreakButtonProps) {
  const t = useMessages(entriesMessages).breaks
  const day = useBreakDay(date)
  const start = useStartBreak()
  if (day.running) return null
  return (
    <Button
      variant="outline"
      disabled={start.isPending}
      onClick={() => start.mutate()}
    >
      <Coffee aria-hidden />
      {t.startLabel}
    </Button>
  )
}

interface BreaksDialogProps {
  date: string
  day: ReturnType<typeof useBreakDay>
  onClose: () => void
}

/** Lista przerw z dnia z usuwaniem i dopisaniem zapomnianej przerwy. */
function BreaksDialog({ date, day, onClose }: BreaksDialogProps) {
  const t = useMessages(entriesMessages).breaks
  const app = useMessages(appMessages)
  const format = useFormat()
  const [duration, setDuration] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const hasTimes = from.trim() !== '' || to.trim() !== ''
  const between =
    TIME_RE.test(from) && TIME_RE.test(to) ? minutesBetween(from, to) : null
  const minutes = hasTimes ? between : parseDuration(duration)
  const error = hasTimes
    ? between === null || between < 1
      ? t.timesError
      : null
    : minutes === null || minutes < 1 || minutes > 1440
      ? t.durationError
      : null

  const add = useDataMutation(
    () =>
      breaksApi.add({
        workDate: date,
        startTime: hasTimes ? from : null,
        endTime: hasTimes ? to : null,
        durationMinutes: minutes ?? 1,
      }),
    {
      invalidate: [breakKeys.all],
      success: (added) =>
        fmt(t.added, { time: format.minutes(added.durationMinutes) }),
      onSuccess: () => {
        setDuration('')
        setFrom('')
        setTo('')
        setSubmitted(false)
      },
    },
  )
  const remove = useDataMutation((id: string) => breaksApi.remove(id), {
    invalidate: [breakKeys.all],
    success: t.removed,
  })

  const label = (b: WorkBreak) =>
    b.startTime && b.endTime
      ? format.timeRange(b.startTime, b.endTime)
      : b.running && b.startTime
        ? `${format.time(b.startTime)}–${t.now}`
        : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (error) return
    add.mutate()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={t.dialogTitle}
        description={
          day.limit > 0
            ? fmt(t.dialogLead, { limit: format.minutes(day.limit) })
            : t.dialogLeadNoLimit
        }
        closeLabel={app.actions.close}
      >
        {day.list.length === 0 ? (
          <p className="text-ink-soft">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {day.list.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <Coffee aria-hidden className="size-4 shrink-0 text-ink-soft" />
                <span className="flex-1 text-sm tabular-nums">{label(b)}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {b.running ? '…' : format.minutes(b.durationMinutes)}
                </span>
                {!b.running && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={remove.isPending}
                    aria-label={fmt(t.removeLabel, {
                      time: label(b) ?? format.minutes(b.durationMinutes),
                    })}
                    onClick={() => remove.mutate(b.id)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          noValidate
          onSubmit={submit}
          className="mt-6 space-y-4 border-t border-line pt-5"
        >
          <div>
            <h3 className="font-semibold">{t.add}</h3>
            <p className="text-sm text-ink-soft">{t.addLead}</p>
          </div>
          <Field
            label={t.duration}
            error={submitted && !hasTimes ? error : null}
          >
            {(a) => (
              <div className="space-y-2">
                <Input
                  {...a}
                  autoComplete="off"
                  disabled={hasTimes}
                  value={hasTimes && minutes ? String(minutes) : duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 30].map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={
                        !hasTimes && minutes === m ? 'default' : 'outline'
                      }
                      aria-pressed={!hasTimes && minutes === m}
                      disabled={hasTimes}
                      onClick={() => setDuration(String(m))}
                    >
                      {format.minutes(m)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <fieldset>
            <legend className="text-sm text-ink-soft">{t.timesHint}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label={t.from}>
                {(a) => <TimeInput {...a} value={from} onChange={setFrom} />}
              </Field>
              <Field label={t.to} error={submitted && hasTimes ? error : null}>
                {(a) => <TimeInput {...a} value={to} onChange={setTo} />}
              </Field>
            </div>
          </fieldset>
          <Button
            type="submit"
            disabled={add.isPending}
            aria-busy={add.isPending}
          >
            {t.add}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
