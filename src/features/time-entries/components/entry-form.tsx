import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Clock, Link2, Play, Timer, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import { Select, Switch, Textarea } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { data } from '#/data'
import type {
  FieldRequirement,
  SpScaleStep,
  TaskType,
  TimeEntry,
  TimeEntryInput,
  TimeInputMode,
  TimerStartInput,
} from '#/data/types'
import { nowTimeIn, todayIn } from '#/domain/dates'
import {
  ENTRY_LIMITS,
  fromMinutes,
  isFutureStart,
  minutesBetween,
  parseDuration,
  toMinutes,
  validateEntry,
} from '#/domain/entries'
import type { EntryField, EntryIssue } from '#/domain/entries'
import { extractTaskKey } from '#/domain/rules'
import { suggestPoints } from '#/domain/sp-scale'
import {
  mutationFieldError,
  projectsQuery,
  scaleQuery,
  settingsQuery,
  taskTypesQuery,
  useDataMutation,
} from '#/features/settings/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'
import { entryKeys } from '../queries'

/** 'timer' = start bez godziny końca; zatrzymuje się później jednym kliknięciem. */
type DraftMode = TimeInputMode | 'timer'

type Draft = {
  taskTypeId: string
  title: string
  link: string
  mode: DraftMode
  start: string
  end: string
  duration: string
  storyPoints: string
  projectId: string
  note: string
  /** Nadgodziny włączone: część czasu wpisu była po godzinach. */
  overtime: boolean
  /** Czas nadgodzin w tych samych formatach co czas trwania ("90", "1h 30m"). */
  overtimeDuration: string
  overtimeNote: string
  /** Estymata całego zadania w tych samych formatach co czas ("4h", "90"); '' = brak. */
  estimate: string
  /** Przedłużenie ustawiane przyciskiem „Przedłużyło się” na liście; formularz je zachowuje. */
  extensionMinutes: number | null
  extensionNote: string | null
}

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120]

function nowRounded() {
  const d = new Date()
  return Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5
}

function initialDraft(
  entry: TimeEntry | null,
  type: TaskType | undefined,
): Draft {
  if (entry) {
    return {
      taskTypeId: entry.taskTypeId,
      title: entry.title,
      link: entry.link ?? '',
      mode: entry.running ? 'timer' : entry.startTime ? 'range' : 'duration',
      start: entry.startTime ?? '',
      end: entry.endTime ?? '',
      duration: String(entry.durationMinutes),
      storyPoints: entry.storyPoints === null ? '' : String(entry.storyPoints),
      projectId: entry.projectId ?? '',
      note: entry.note ?? '',
      overtime: entry.overtimeMinutes !== null,
      overtimeDuration:
        entry.overtimeMinutes === null ? '' : String(entry.overtimeMinutes),
      overtimeNote: entry.overtimeNote ?? '',
      estimate:
        entry.estimateMinutes === null ? '' : String(entry.estimateMinutes),
      extensionMinutes: entry.extensionMinutes,
      extensionNote: entry.extensionNote,
    }
  }
  const end = Math.max(30, nowRounded())
  return {
    taskTypeId: type?.id ?? '',
    title: '',
    link: '',
    mode: type?.defaultTimeInput ?? 'duration',
    start: fromMinutes(end - 30),
    end: fromMinutes(end),
    duration: '',
    storyPoints: spDefault(type),
    projectId: '',
    note: '',
    overtime: false,
    overtimeDuration: '',
    overtimeNote: '',
    estimate: '',
    extensionMinutes: null,
    extensionNote: null,
  }
}

/** SP zaznaczone na start dla typu pracy; '' = bez SP. */
function spDefault(type: TaskType | undefined) {
  if (!type || type.storyPointsRequirement === 'hidden') return ''
  return type.defaultStoryPoints === null ? '' : String(type.defaultStoryPoints)
}

/** Minuty z bieżącego trybu czasu (null = jeszcze nie da się policzyć). */
function draftMinutes(d: Draft) {
  if (d.mode === 'timer') return null
  return d.mode === 'range'
    ? minutesBetween(d.start, d.end)
    : parseDuration(d.duration)
}

function toInput(
  d: Draft,
  workDate: string,
  spRequirement: TaskType['storyPointsRequirement'],
): TimeEntryInput {
  const minutes = draftMinutes(d) ?? 0
  return {
    taskTypeId: d.taskTypeId,
    projectId: d.projectId || null,
    title: d.title.trim(),
    link: d.link.trim() || null,
    storyPoints:
      spRequirement === 'hidden' || d.storyPoints === ''
        ? null
        : Number(d.storyPoints),
    workDate,
    startTime: d.mode === 'duration' ? null : d.start || null,
    endTime: d.mode === 'range' ? d.end || null : null,
    durationMinutes: d.mode === 'timer' ? 0 : minutes,
    note: d.note.trim() ? d.note : null,
    ...overtimeOf(d),
    estimateMinutes: d.estimate.trim()
      ? (parseDuration(d.estimate) ?? -1)
      : null,
    extensionMinutes: d.mode === 'timer' ? null : d.extensionMinutes,
    extensionNote: d.mode === 'timer' ? null : d.extensionNote,
    running: d.mode === 'timer',
  }
}

/**
 * Nadgodziny z formularza. Wyłączone albo timer = brak nadgodzin.
 * Puste pole czasu przy włączonych nadgodzinach = cały czas wpisu.
 */
function overtimeOf(
  d: Draft,
): Pick<TimeEntryInput, 'overtimeMinutes' | 'overtimeNote'> {
  if (!d.overtime || d.mode === 'timer')
    return { overtimeMinutes: null, overtimeNote: null }
  const minutes = d.overtimeDuration.trim()
    ? (parseDuration(d.overtimeDuration) ?? -1)
    : (draftMinutes(d) ?? -1)
  return { overtimeMinutes: minutes, overtimeNote: d.overtimeNote }
}

function toTimerInput(input: TimeEntryInput): TimerStartInput {
  const {
    endTime: _end,
    durationMinutes: _min,
    running: _run,
    overtimeMinutes: _overtime,
    overtimeNote: _overtimeNote,
    extensionMinutes: _extension,
    extensionNote: _extensionNote,
    ...rest
  } = input
  return { ...rest, startTime: input.startTime ?? '' }
}

type EntryFormProps = {
  workDate: string
  entry?: TimeEntry | null
  /** Id formularza, gdy przycisk zapisu jest poza nim (stopka okna dialogowego). */
  formId?: string
  hideSubmit?: boolean
  focusNotes?: boolean
  onSaved?: (entry: TimeEntry) => void
}

/**
 * Formularz wpisu czasu. Pola dopasowują się do typu pracy (link, notatki, sposób
 * podawania czasu), a notatki są dostępne dla każdego typu, o ile nie ukryto ich w ustawieniach.
 */
export function EntryForm(props: EntryFormProps) {
  // Stan formularza startuje z domyślnymi wartościami typu, więc czekamy na typy, skalę i projekty.
  const ready = [
    useQuery(taskTypesQuery),
    useQuery(scaleQuery),
    useQuery(projectsQuery),
  ].every((q) => q.isSuccess)
  if (!ready) {
    return (
      <div role="status" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden
            className="h-11 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  }
  return <EntryFormFields {...props} />
}

function EntryFormFields({
  workDate,
  entry = null,
  formId,
  hideSubmit,
  focusNotes,
  onSaved,
}: EntryFormProps) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const uid = useId()
  const types = (useQuery(taskTypesQuery).data ?? []).filter(
    (x) => !x.archivedAt || x.id === entry?.taskTypeId,
  )
  const projects = (useQuery(projectsQuery).data ?? []).filter(
    (p) => !p.archivedAt || p.id === entry?.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const timeZone = useQuery(settingsQuery).data?.timezone
  const nowTime = () => nowTimeIn(timeZone)
  // Timer liczy czas od teraz, więc nowy wpis z timerem jest możliwy tylko dziś.
  const timerAllowed = workDate === todayIn(timeZone)
  const [customFor, setCustomFor] = useState<TaskType | null>(null)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(entry, types[0]))
  // Zmiana dnia na przeszły w trakcie wypełniania: timer przechodzi na „czas trwania”.
  useEffect(() => {
    if (!timerAllowed && !entry && draft.mode === 'timer')
      setDraft((d) => ({ ...d, mode: 'duration' }))
  }, [timerAllowed, entry, draft.mode])
  const [submitted, setSubmitted] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const type = types.find((x) => x.id === draft.taskTypeId) ?? types[0]
  const save = useDataMutation(
    (input: TimeEntryInput) =>
      entry ? data.entries.update(entry.id, input) : data.entries.create(input),
    {
      invalidate: [entryKeys.all],
      success: entry ? t.form.updated : t.form.saved,
      onSuccess: (saved) => {
        onSaved?.(saved)
        if (!entry) {
          // Nowy wpis: zostaje typ i projekt, a następny zaczyna się tam, gdzie skończył się ten.
          setDraft((d) => ({
            ...initialDraft(null, type),
            taskTypeId: d.taskTypeId,
            projectId: d.projectId,
            mode: d.mode,
            start:
              d.mode === 'range' && d.end
                ? d.end
                : initialDraft(null, type).start,
            end:
              d.mode === 'range' && d.end
                ? fromMinutes(Math.min(toMinutes(d.end) + 30, 23 * 60 + 55))
                : initialDraft(null, type).end,
          }))
          setSubmitted(false)
          titleRef.current?.focus()
        }
      },
    },
  )

  const startTimer = useDataMutation(
    (input: TimerStartInput) => data.entries.start(input),
    {
      invalidate: [entryKeys.all],
      success: t.form.timerStarted,
      onSuccess: (result) => {
        if (result.stopped) {
          toast(
            fmt(t.form.previousStopped, {
              name: result.stopped.title,
              time: format.minutes(result.stopped.durationMinutes),
            }),
          )
        }
        onSaved?.(result.started)
        setDraft((d) => ({
          ...initialDraft(null, type),
          taskTypeId: d.taskTypeId,
          projectId: d.projectId,
          mode: 'duration',
        }))
        setSubmitted(false)
        titleRef.current?.focus()
      },
    },
  )
  const pending = save.isPending || startTimer.isPending

  if (!type) return <p className="text-ink-soft">{t.form.noTypes}</p>

  const input = toInput(
    { ...draft, taskTypeId: type.id },
    workDate,
    type.storyPointsRequirement,
  )
  const issues = validateEntry(input, type)
  if (
    draft.mode === 'timer' &&
    !issues.some((i) => i.field === 'time') &&
    isFutureStart(draft.start, nowTime())
  ) {
    issues.push({ field: 'time', code: 'future' })
  }
  const minutes = draftMinutes(draft)
  const suggested = minutes ? suggestPoints(scale, minutes) : null
  const spRequirement = type.storyPointsRequirement
  const chosenSp = draft.storyPoints === '' ? null : Number(draft.storyPoints)
  const taskKey = draft.link ? extractTaskKey(draft.link) : null

  const issueText = (field: EntryField) => {
    if (!submitted) return null
    const issue = issues.find((i) => i.field === field)
    if (issue) return messageFor(issue)
    return mutationFieldError(save.error, field)
  }
  const messageFor = (issue: EntryIssue): string => {
    const group = t.issues[issue.field as keyof typeof t.issues] as
      Record<string, string> | undefined
    return group?.[issue.code] ?? t.issues.time.invalid
  }

  const changeType = (next: TaskType) => {
    setDraft((d) => ({
      ...d,
      taskTypeId: next.id,
      mode: d.title || d.duration ? d.mode : next.defaultTimeInput,
      storyPoints: entry ? d.storyPoints : spDefault(next),
    }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (issues.length > 0) {
      const first = issues[0]!.field
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    if (draft.mode === 'timer' && !entry) startTimer.mutate(toTimerInput(input))
    else save.mutate(input)
  }

  /** Szybki wpis z menu kontekstowego typu: ustawia typ i czas, fokus wraca do tytułu. */
  const quickLog = (next: TaskType, minutesValue: number | 'timer') => {
    changeType(next)
    setDraft((d) =>
      minutesValue === 'timer'
        ? { ...d, taskTypeId: next.id, mode: 'timer', start: nowTime() }
        : {
            ...d,
            taskTypeId: next.id,
            mode: 'duration',
            duration: String(minutesValue),
          },
    )
    // Po zamknięciu menu/okna Radix oddaje fokus; tytuł przejmuje go chwilę później.
    window.setTimeout(() => titleRef.current?.focus(), 30)
  }

  const timeOptions: Array<{ value: DraftMode; label: string }> = (
    entry
      ? entry.running
        ? (['timer', 'range'] as const)
        : (['range', 'duration'] as const)
      : timerAllowed
        ? (['range', 'duration', 'timer'] as const)
        : (['range', 'duration'] as const)
  ).map((value) => ({ value, label: t.form.timeModes[value] }))

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.currentTarget.requestSubmit()
    }
  }

  const requirementLabel = (r: FieldRequirement) =>
    r === 'required' ? t.form.required : t.form.optional
  const describedBy = (field: EntryField, hint?: boolean) =>
    [
      issueText(field) ? `${uid}-${field}-error` : null,
      hint ? `${uid}-${field}-hint` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined
  const error = (field: EntryField) => {
    const text = issueText(field)
    return text ? (
      <p
        id={`${uid}-${field}-error`}
        className="mt-1.5 text-sm text-destructive"
      >
        {text}
      </p>
    ) : null
  }

  const noteLength = draft.note.length
  const nearLimit = noteLength > ENTRY_LIMITS.note * 0.9
  const overtimeMinutes = input.overtimeMinutes

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        className="space-y-6"
      >
        {/* Rodzaj pracy: natywne radio — strzałki, Tab i czytniki ekranu działają same */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {t.form.typeLegend}
          </legend>
          <div className="flex flex-wrap gap-2">
            {types.map((x) => (
              <ContextMenu key={x.id}>
                <ContextMenuTrigger asChild>
                  <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors select-none hover:border-ink/40 hover:text-ink has-checked:border-transparent has-checked:bg-[var(--ink-fixed)] has-checked:text-white has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/40">
                    <input
                      type="radio"
                      name={`${uid}-type`}
                      className="sr-only"
                      aria-describedby={`${uid}-quick-hint`}
                      checked={x.id === type.id}
                      onChange={() => changeType(x)}
                    />
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: x.color }}
                    />
                    {x.name}
                  </label>
                </ContextMenuTrigger>
                <ContextMenuContent
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  aria-label={fmt(t.form.quickMenu.label, { name: x.name })}
                >
                  <ContextMenuLabel>
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2 rounded-full"
                      style={{ background: x.color }}
                    />
                    {x.name}
                  </ContextMenuLabel>
                  {QUICK_DURATIONS.map((m) => (
                    <ContextMenuItem key={m} onSelect={() => quickLog(x, m)}>
                      <Clock aria-hidden />
                      {fmt(t.form.quickMenu.log, { time: format.minutes(m) })}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuItem onSelect={() => setCustomFor(x)}>
                    <Wand2 aria-hidden />
                    {t.form.quickMenu.custom}
                  </ContextMenuItem>
                  {!entry && timerAllowed && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => quickLog(x, 'timer')}>
                        <Play aria-hidden />
                        {t.form.quickMenu.timer}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
          <p id={`${uid}-quick-hint`} className="mt-2 text-sm text-ink-soft">
            {t.form.quickHint}
          </p>
        </fieldset>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${uid}-title`}
              className="block text-sm font-medium"
            >
              {type.titleLabel}{' '}
              <span className="font-normal text-ink-soft">
                {t.form.required}
              </span>
            </label>
            <Input
              ref={titleRef}
              id={`${uid}-title`}
              className="mt-2"
              autoComplete="off"
              maxLength={ENTRY_LIMITS.title}
              aria-invalid={issueText('title') ? true : undefined}
              aria-describedby={describedBy('title')}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            {error('title')}
          </div>

          {type.linkRequirement !== 'hidden' && (
            <div className="sm:col-span-2">
              <label
                htmlFor={`${uid}-link`}
                className="block text-sm font-medium"
              >
                {type.linkLabel || t.form.link}{' '}
                <span className="font-normal text-ink-soft">
                  {requirementLabel(type.linkRequirement)}
                </span>
              </label>
              <div className="relative mt-2">
                <Link2
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
                />
                <Input
                  id={`${uid}-link`}
                  type="url"
                  inputMode="url"
                  className="pl-10"
                  placeholder="https://"
                  spellCheck={false}
                  aria-invalid={issueText('link') ? true : undefined}
                  aria-describedby={describedBy('link', Boolean(taskKey))}
                  value={draft.link}
                  onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                />
              </div>
              {taskKey && !issueText('link') && (
                <p
                  id={`${uid}-link-hint`}
                  className="mt-1.5 text-sm text-ink-soft"
                >
                  {fmt(t.form.detected, { key: taskKey })}
                </p>
              )}
              {error('link')}
            </div>
          )}

          {/* Czas */}
          <div className="sm:col-span-2">
            <Segmented<DraftMode>
              label={t.form.time}
              size="sm"
              value={draft.mode}
              onChange={(mode) =>
                setDraft({
                  ...draft,
                  mode,
                  start:
                    mode === 'timer' && draft.mode !== 'timer'
                      ? (entry?.startTime ?? nowTime())
                      : draft.start,
                  duration:
                    mode === 'duration' && !draft.duration && minutes
                      ? String(minutes)
                      : draft.duration,
                })
              }
              options={timeOptions}
            />
            <div className="mt-3">
              {draft.mode === 'timer' ? (
                <div>
                  <label
                    htmlFor={`${uid}-time`}
                    className="block text-sm text-ink-soft"
                  >
                    {t.form.startedAt}
                  </label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Input
                      id={`${uid}-time`}
                      type="time"
                      className="w-36"
                      aria-invalid={issueText('time') ? true : undefined}
                      aria-describedby={describedBy('time', true)}
                      value={draft.start}
                      onChange={(e) =>
                        setDraft({ ...draft, start: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDraft({ ...draft, start: nowTime() })}
                    >
                      <Clock aria-hidden className="size-4" />
                      {t.form.now}
                    </Button>
                  </div>
                  <p
                    id={`${uid}-time-hint`}
                    className="mt-1.5 text-sm text-ink-soft"
                  >
                    {t.form.timerHint}
                  </p>
                </div>
              ) : draft.mode === 'range' ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label
                      htmlFor={`${uid}-time`}
                      className="block text-sm text-ink-soft"
                    >
                      {t.form.start}
                    </label>
                    <Input
                      id={`${uid}-time`}
                      type="time"
                      step={300}
                      className="mt-1 w-36"
                      aria-invalid={issueText('time') ? true : undefined}
                      aria-describedby={describedBy('time')}
                      value={draft.start}
                      onChange={(e) =>
                        setDraft({ ...draft, start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${uid}-end`}
                      className="block text-sm text-ink-soft"
                    >
                      {t.form.end}
                    </label>
                    <Input
                      id={`${uid}-end`}
                      type="time"
                      step={300}
                      className="mt-1 w-36"
                      aria-invalid={issueText('time') ? true : undefined}
                      aria-describedby={describedBy('time')}
                      value={draft.end}
                      onChange={(e) =>
                        setDraft({ ...draft, end: e.target.value })
                      }
                    />
                  </div>
                  <p
                    className="pb-3 text-sm font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {minutes ? format.minutes(minutes) : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor={`${uid}-time`} className="sr-only">
                    {t.form.duration}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id={`${uid}-time`}
                      inputMode="text"
                      autoComplete="off"
                      className="w-36"
                      placeholder="1h 15m"
                      aria-invalid={issueText('time') ? true : undefined}
                      aria-describedby={describedBy('time', true)}
                      value={draft.duration}
                      onChange={(e) =>
                        setDraft({ ...draft, duration: e.target.value })
                      }
                    />
                    <div
                      role="group"
                      aria-label={t.form.quick}
                      className="flex flex-wrap gap-1.5"
                    >
                      {QUICK_DURATIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={minutes === m}
                          onClick={() =>
                            setDraft({ ...draft, duration: String(m) })
                          }
                          className="h-9 rounded-full border border-line px-3 text-sm font-medium text-ink-soft hover:border-ink/40 hover:text-ink aria-pressed:border-transparent aria-pressed:bg-muted aria-pressed:text-ink"
                        >
                          {format.minutes(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p
                    id={`${uid}-time-hint`}
                    className="mt-1.5 text-sm text-ink-soft"
                  >
                    {minutes ? (
                      <span className="font-medium text-ink">
                        = {format.minutes(minutes)}.{' '}
                      </span>
                    ) : null}
                    {t.form.durationHint}
                  </p>
                </div>
              )}
              {error('time')}
              {error('extension')}
              {draft.extensionMinutes !== null && !issueText('extension') && (
                <p className="mt-1.5 text-sm text-ink-soft">
                  {fmt(t.extension.inForm, {
                    time: format.minutes(draft.extensionMinutes),
                    reason: draft.extensionNote ?? '',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Story pointy ze skali; typ pracy decyduje, czy są wymagane, opcjonalne, czy ukryte */}
          {spRequirement !== 'hidden' && (
            <fieldset
              className="sm:col-span-2"
              aria-describedby={
                error('storyPoints') ? `${uid}-storyPoints-error` : undefined
              }
            >
              <legend className="mb-2 text-sm font-medium">
                {t.form.spLegend}{' '}
                <span className="font-normal text-ink-soft">
                  {spRequirement === 'optional'
                    ? t.form.optional
                    : t.form.required}
                </span>
              </legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {spRequirement === 'optional' && (
                  <label className="grid h-10 cursor-pointer place-items-center rounded-lg border border-line px-3 text-sm font-medium hover:border-ink/40 has-checked:border-transparent has-checked:bg-[var(--ink-fixed)] has-checked:text-white has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40">
                    <input
                      id={`${uid}-storyPoints`}
                      type="radio"
                      name={`${uid}-sp`}
                      className="sr-only"
                      checked={draft.storyPoints === ''}
                      onChange={() => setDraft({ ...draft, storyPoints: '' })}
                    />
                    {t.form.spNone}
                  </label>
                )}
                {withValue(scale, chosenSp).map((s, i) => (
                  <label
                    key={s.points}
                    className="grid h-10 min-w-11 cursor-pointer place-items-center rounded-lg border border-line px-2.5 text-sm font-semibold tabular-nums hover:border-ink/40 has-checked:border-transparent has-checked:bg-[var(--ink-fixed)] has-checked:text-white has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40"
                  >
                    <input
                      id={
                        i === 0 && spRequirement !== 'optional'
                          ? `${uid}-storyPoints`
                          : undefined
                      }
                      type="radio"
                      name={`${uid}-sp`}
                      className="sr-only"
                      checked={chosenSp === s.points}
                      onChange={() =>
                        setDraft({ ...draft, storyPoints: String(s.points) })
                      }
                    />
                    {format.number(s.points)}
                    <span className="sr-only"> SP</span>
                  </label>
                ))}
                {suggested !== null && suggested !== chosenSp && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft({ ...draft, storyPoints: String(suggested) })
                    }
                  >
                    <Wand2 aria-hidden className="size-4" />
                    {fmt(t.form.spSuggest, { sp: format.sp(suggested) })}
                  </Button>
                )}
              </div>
              {error('storyPoints')}
            </fieldset>
          )}

          {projects.length > 0 && (
            <div>
              <label
                htmlFor={`${uid}-project`}
                className="block text-sm font-medium"
              >
                {t.form.project}
              </label>
              <Select
                id={`${uid}-project`}
                className="mt-2"
                value={draft.projectId}
                onChange={(e) =>
                  setDraft({ ...draft, projectId: e.target.value })
                }
              >
                <option value="">{t.form.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key ? `${p.name} (${p.key})` : p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Estymata całego zadania (nie spotkania): raport porówna ją z prawdziwym czasem */}
          {type.kind !== 'meeting' && (
            <div>
              <label
                htmlFor={`${uid}-estimate`}
                className="block text-sm font-medium"
              >
                {t.form.estimate}{' '}
                <span className="font-normal text-ink-soft">
                  {t.form.optional}
                </span>
              </label>
              <Input
                id={`${uid}-estimate`}
                className="mt-2"
                inputMode="text"
                autoComplete="off"
                placeholder={t.form.estimatePlaceholder}
                aria-invalid={issueText('estimate') ? true : undefined}
                aria-describedby={describedBy(
                  'estimate',
                  !issueText('estimate'),
                )}
                value={draft.estimate}
                onChange={(e) =>
                  setDraft({ ...draft, estimate: e.target.value })
                }
              />
              {error('estimate') ?? (
                <p
                  id={`${uid}-estimate-hint`}
                  className="mt-1.5 text-sm text-ink-soft"
                >
                  {draft.estimate.trim() && parseDuration(draft.estimate)
                    ? `= ${format.minutes(parseDuration(draft.estimate)!)}. `
                    : ''}
                  {t.form.estimateHint}
                </p>
              )}
            </div>
          )}

          {/* Notatki: co konkretnie zostało zrobione */}
          {type.descriptionRequirement !== 'hidden' && (
            <div className="sm:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`${uid}-note`}
                  className="block text-sm font-medium"
                >
                  {t.form.notes}{' '}
                  <span className="font-normal text-ink-soft">
                    {requirementLabel(type.descriptionRequirement)}
                  </span>
                </label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    nearLimit
                      ? 'font-medium text-destructive'
                      : 'text-ink-soft',
                  )}
                  aria-hidden
                >
                  {noteLength}/{ENTRY_LIMITS.note}
                </span>
              </div>
              <Textarea
                id={`${uid}-note`}
                rows={4}
                autoFocus={focusNotes}
                maxLength={ENTRY_LIMITS.note}
                placeholder={t.form.notesPlaceholder}
                className="mt-2 resize-y leading-relaxed"
                aria-invalid={issueText('note') ? true : undefined}
                aria-describedby={describedBy('note', true)}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
              <p
                id={`${uid}-note-hint`}
                className="mt-1.5 text-sm text-ink-soft"
              >
                {t.form.notesHint}
                {nearLimit && (
                  <span className="sr-only">
                    {' '}
                    {fmt(t.form.notesCount, {
                      count: noteLength,
                      max: ENTRY_LIMITS.note,
                    })}
                  </span>
                )}
              </p>
              {error('note')}
            </div>
          )}

          {/* Nadgodziny: ile z tego czasu było po godzinach i co wtedy robiłeś */}
          <div className="rounded-xl border border-line p-4 sm:col-span-2">
            <Switch
              label={t.form.overtime.label}
              description={
                draft.mode === 'timer'
                  ? t.form.overtime.timerHint
                  : t.form.overtime.hint
              }
              checked={draft.overtime && draft.mode !== 'timer'}
              disabled={draft.mode === 'timer'}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, overtime: checked })
              }
            />
            {draft.overtime && draft.mode !== 'timer' && (
              <div className="overtime-in mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label
                    htmlFor={`${uid}-overtime`}
                    className="block text-sm font-medium"
                  >
                    {t.form.overtime.time}
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      id={`${uid}-overtime`}
                      inputMode="text"
                      autoComplete="off"
                      className="w-36"
                      placeholder={minutes ? format.minutes(minutes) : '1h 30m'}
                      aria-invalid={issueText('overtime') ? true : undefined}
                      aria-describedby={describedBy('overtime', true)}
                      value={draft.overtimeDuration}
                      onChange={(e) =>
                        setDraft({ ...draft, overtimeDuration: e.target.value })
                      }
                    />
                    {minutes ? (
                      <button
                        type="button"
                        aria-pressed={
                          !draft.overtimeDuration.trim() ||
                          parseDuration(draft.overtimeDuration) === minutes
                        }
                        onClick={() =>
                          setDraft({
                            ...draft,
                            overtimeDuration: String(minutes),
                          })
                        }
                        className="h-9 rounded-full border border-line px-3 text-sm font-medium text-ink-soft hover:border-ink/40 hover:text-ink aria-pressed:border-transparent aria-pressed:bg-muted aria-pressed:text-ink"
                      >
                        {fmt(t.form.overtime.whole, {
                          time: format.minutes(minutes),
                        })}
                      </button>
                    ) : null}
                  </div>
                  <p
                    id={`${uid}-overtime-hint`}
                    className="mt-1.5 text-sm text-ink-soft"
                    aria-live="polite"
                  >
                    {overtimeMinutes && overtimeMinutes > 0 && minutes ? (
                      <span className="font-medium text-ink">
                        {fmt(t.form.overtime.share, {
                          overtime: format.minutes(overtimeMinutes),
                          total: format.minutes(minutes),
                        })}{' '}
                      </span>
                    ) : null}
                    {t.form.overtime.timeHint}
                  </p>
                  {error('overtime')}
                </div>
                <div>
                  <label
                    htmlFor={`${uid}-overtimeNote`}
                    className="block text-sm font-medium"
                  >
                    {t.form.overtime.note}{' '}
                    <span className="font-normal text-ink-soft">
                      {t.form.required}
                    </span>
                  </label>
                  <Textarea
                    id={`${uid}-overtimeNote`}
                    rows={3}
                    maxLength={ENTRY_LIMITS.overtimeNote}
                    placeholder={t.form.overtime.notePlaceholder}
                    className="mt-2 resize-y leading-relaxed"
                    aria-invalid={issueText('overtimeNote') ? true : undefined}
                    aria-describedby={describedBy('overtimeNote')}
                    value={draft.overtimeNote}
                    onChange={(e) =>
                      setDraft({ ...draft, overtimeNote: e.target.value })
                    }
                  />
                  {error('overtimeNote')}
                </div>
              </div>
            )}
          </div>
        </div>

        {!hideSubmit && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {t.form.saveHint}
            </span>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              aria-busy={pending}
            >
              {draft.mode === 'timer' && !entry ? (
                <Timer aria-hidden className="size-4" />
              ) : (
                <Check aria-hidden className="size-4" />
              )}
              {pending
                ? t.form.saving
                : draft.mode === 'timer' && !entry
                  ? t.form.startTimer
                  : t.form.save}
            </Button>
          </div>
        )}
      </form>
      {/* Poza <form>: zdarzenia z portalu i tak płyną drzewem Reacta, więc nie zagnieżdżamy formularzy */}
      {customFor && (
        <CustomDurationDialog
          type={customFor}
          onClose={() => setCustomFor(null)}
          onApply={(m) => {
            quickLog(customFor, m)
            setCustomFor(null)
          }}
        />
      )}
    </>
  )
}

/** Własny czas z menu kontekstowego: jedno pole, te same formaty co w formularzu. */
function CustomDurationDialog({
  type,
  onClose,
  onApply,
}: {
  type: TaskType
  onClose: () => void
  onApply: (minutes: number) => void
}) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const id = useId()
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const minutes = parseDuration(value)
  const valid =
    minutes !== null && minutes >= 1 && minutes <= ENTRY_LIMITS.maxMinutes
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={`${t.form.custom.title}: ${type.name}`}
        description={t.form.custom.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button type="submit" form={`${id}-form`}>
              {t.form.custom.apply}
            </Button>
          </>
        }
      >
        <form
          id={`${id}-form`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setSubmitted(true)
            if (valid) onApply(minutes)
          }}
        >
          <label htmlFor={`${id}-input`} className="block text-sm font-medium">
            {t.form.custom.label}
          </label>
          <Input
            id={`${id}-input`}
            autoFocus
            autoComplete="off"
            className="mt-2"
            placeholder="1h 20m"
            aria-invalid={submitted && !valid ? true : undefined}
            aria-describedby={`${id}-status`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p
            id={`${id}-status`}
            aria-live="polite"
            className={cn(
              'mt-1.5 text-sm',
              submitted && !valid ? 'text-destructive' : 'text-ink-soft',
            )}
          >
            {submitted && !valid
              ? t.form.custom.error
              : valid
                ? `= ${format.minutes(minutes)}`
                : ''}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Skala z dodaną wartością wpisu, gdy skala zmieniła się po jego zapisaniu. */
function withValue(scale: Array<SpScaleStep>, points: number | null) {
  if (points === null || scale.some((s) => s.points === points)) return scale
  return [...scale, { id: 'current', points, maxMinutes: 0 }].sort(
    (a, b) => a.points - b.points,
  )
}
