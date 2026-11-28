import { formatClock } from '../domain/clock'
import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { ProgressBar } from '#/components/ui/progress-bar'
import { StatTile } from '#/components/ui/stats'
import { TimeInput } from '#/components/ui/time-input'
import {
  useBreakDay,
  useBreakListActions,
  useEndBreak,
  useStartBreak,
} from '#/features/breaks/controllers/use-breaks'
import { readBreakDraft } from '#/features/breaks/domain/break-form'
import type { WorkBreak } from '#/features/breaks/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { Coffee, List as ListIcon, Play, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

export interface BreakBarProps {
  running: WorkBreak
}

/**
 * Pasek trwającej przerwy (zamiast paska timera): licznik, ile zostało z dziennego limitu
 * i „Koniec przerwy”, które od razu wznawia zadanie wstrzymane na jej czas.
 */
export function BreakBar({ running }: BreakBarProps) {
  const messages = useMessages(entriesMessages)
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
      aria-label={messages.breaks.running}
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
            {messages.breaks.running}
            {running.startTime &&
              ` · ${fmt(messages.breaks.since, { time: format.time(running.startTime) })}`}
          </p>
          {day.limit > 0 && (
            <p className="truncate text-xs text-white/75">
              {left >= 0
                ? fmt(messages.breaks.left, { time: format.minutes(left) })
                : fmt(messages.breaks.over, { time: format.minutes(-left) })}
            </p>
          )}
        </div>
        <span
          role="timer"
          aria-label={fmt(messages.timer.elapsed, {
            time: formatClock(day.seconds),
          })}
          className="font-mono text-lg font-semibold tabular-nums sm:text-xl"
        >
          {formatClock(day.seconds)}
        </span>
        {/* Telefon: dwa równe przyciski w osobnym wierszu, tekst może się zawinąć, żeby pasek
            nie rozpychał strony w bok; od sm obok licznika. */}
        <div className="grid w-full auto-cols-fr grid-flow-col gap-2 sm:flex sm:w-auto sm:shrink-0">
          {running.resumeEntryId && (
            <Button
              variant="outline"
              disabled={end.isPending}
              onClick={() => end.mutate({ id: running.id, resume: false })}
              className="h-auto min-h-10 border-white/30 bg-transparent px-3 py-1.5 leading-tight whitespace-normal text-white hover:bg-white/10 hover:text-white sm:whitespace-nowrap"
            >
              {messages.breaks.endOnly}
            </Button>
          )}
          <Button
            disabled={end.isPending}
            onClick={() => end.mutate({ id: running.id, resume: true })}
            className="h-auto min-h-10 bg-white px-3 py-1.5 leading-tight whitespace-normal text-[var(--ink-fixed)] hover:bg-white/90 sm:px-4 sm:whitespace-nowrap"
          >
            {running.resumeEntryId ? (
              <>
                <Play aria-hidden className="size-3.5" fill="currentColor" />
                {messages.breaks.endResume}
              </>
            ) : (
              messages.breaks.end
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
  const messages = useMessages(entriesMessages).breaks
  const format = useFormat()
  const day = useBreakDay(date)
  const [open, setOpen] = useState(false)
  const left = day.limit - day.used
  const share = day.limit > 0 ? Math.min(100, (day.used / day.limit) * 100) : 0

  return (
    <StatTile
      label={messages.tile}
      action={
        <Button
          size="icon"
          variant="ghost"
          className="-my-1.5 -mr-2 size-8"
          title={messages.manage}
          aria-label={messages.manage}
          onClick={() => setOpen(true)}
        >
          <ListIcon aria-hidden className="size-4" />
        </Button>
      }
      value={
        day.limit > 0
          ? fmt(messages.tileValue, {
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
              {fmt(messages.tileOver, { time: format.minutes(-left) })}
            </p>
          ) : (
            <p className="sr-only">
              {fmt(messages.tileLeft, { time: format.minutes(left) })}
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
  const messages = useMessages(entriesMessages).breaks
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
      {messages.startLabel}
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
  const messages = useMessages(entriesMessages).breaks
  const app = useMessages(appMessages)
  const format = useFormat()
  const [duration, setDuration] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const draft = readBreakDraft({ duration, from, to })
  const { hasTimes, minutes } = draft
  const error =
    draft.error === 'times'
      ? messages.timesError
      : draft.error === 'duration'
        ? messages.durationError
        : null

  const { add, remove } = useBreakListActions({
    onAdded: () => {
      setDuration('')
      setFrom('')
      setTo('')
      setSubmitted(false)
    },
  })

  const label = (workBreak: WorkBreak) =>
    workBreak.startTime && workBreak.endTime
      ? format.timeRange(workBreak.startTime, workBreak.endTime)
      : workBreak.running && workBreak.startTime
        ? `${format.time(workBreak.startTime)}–${messages.now}`
        : null

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (error) return
    add.mutate({
      workDate: date,
      startTime: hasTimes ? from : null,
      endTime: hasTimes ? to : null,
      durationMinutes: minutes ?? 1,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={messages.dialogTitle}
        description={
          day.limit > 0
            ? fmt(messages.dialogLead, { limit: format.minutes(day.limit) })
            : messages.dialogLeadNoLimit
        }
        closeLabel={app.actions.close}
      >
        {day.list.length === 0 ? (
          <p className="text-ink-soft">{messages.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {day.list.map((workBreak) => (
              <li
                key={workBreak.id}
                className="flex items-center gap-3 px-3.5 py-2.5"
              >
                <Coffee aria-hidden className="size-4 shrink-0 text-ink-soft" />
                <span className="flex-1 text-sm tabular-nums">
                  {label(workBreak)}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {workBreak.running
                    ? '…'
                    : format.minutes(workBreak.durationMinutes)}
                </span>
                {!workBreak.running && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={remove.isPending}
                    aria-label={fmt(messages.removeLabel, {
                      time:
                        label(workBreak) ??
                        format.minutes(workBreak.durationMinutes),
                    })}
                    onClick={() => remove.mutate(workBreak.id)}
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
            <h3 className="font-semibold">{messages.add}</h3>
            <p className="text-sm text-ink-soft">{messages.addLead}</p>
          </div>
          <Field
            label={messages.duration}
            error={submitted && !hasTimes ? error : null}
          >
            {(fieldProps) => (
              <div className="space-y-2">
                <Input
                  {...fieldProps}
                  autoComplete="off"
                  disabled={hasTimes}
                  value={hasTimes && minutes ? String(minutes) : duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 30].map((presetMinutes) => (
                    <Button
                      key={presetMinutes}
                      type="button"
                      size="sm"
                      variant={
                        !hasTimes && minutes === presetMinutes
                          ? 'default'
                          : 'outline'
                      }
                      aria-pressed={!hasTimes && minutes === presetMinutes}
                      disabled={hasTimes}
                      onClick={() => setDuration(String(presetMinutes))}
                    >
                      {format.minutes(presetMinutes)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <fieldset>
            <legend className="text-sm text-ink-soft">
              {messages.timesHint}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label={messages.from}>
                {(fieldProps) => (
                  <TimeInput {...fieldProps} value={from} onChange={setFrom} />
                )}
              </Field>
              <Field
                label={messages.to}
                error={submitted && hasTimes ? error : null}
              >
                {(fieldProps) => (
                  <TimeInput {...fieldProps} value={to} onChange={setTo} />
                )}
              </Field>
            </div>
          </fieldset>
          <Button
            type="submit"
            disabled={add.isPending}
            aria-busy={add.isPending}
          >
            {messages.add}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
