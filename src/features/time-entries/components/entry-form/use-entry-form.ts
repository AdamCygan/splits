import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { selectable } from '#/domain/archive'
import { entriesApi } from '../../data/api'
import type { TaskType } from '#/features/task-types/data/dto'
import type {
  TimeEntry,
  TimeEntryInput,
  TimerStartInput,
} from '#/features/time-entries/data/dto'
import { nowTimeIn, todayIn } from '#/domain/dates'
import { isFutureStart, validateEntry } from '#/domain/entries'
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
import { entriesMessages } from '#/i18n/messages/entries'
import { entryKeys } from '../../queries'
import {
  afterSave,
  afterTimerStart,
  copyDraft,
  draftMinutes,
  initialDraft,
  scaleWithValue,
  timeModesFor,
  toInput,
  toTimerInput,
  withMode,
  withPrefill,
  withQuickLog,
  withType,
} from './model'
import type { Draft, DraftMode, EntryPrefill } from './model'

export interface EntryFormProps {
  workDate: string
  entry?: TimeEntry | null
  /** Id formularza, gdy przycisk zapisu jest poza nim (stopka okna dialogowego). */
  formId?: string
  hideSubmit?: boolean
  focusNotes?: boolean
  onSaved?: (entry: TimeEntry) => void
  /**
   * Kopia istniejącego wpisu: formularz startuje z jego danymi, a zapis tworzy nowy wpis.
   * Wpis z godzinami dostaje kolejny przedział (od końca oryginału, tyle samo czasu).
   */
  copyOf?: TimeEntry | null
  /** Zadanie z wyszukiwarki albo palety (całe zadanie albo sam tytuł i tryb). */
  prefill?: EntryPrefill | null
}

/** Czy dane potrzebne do startu formularza (typy, skala, projekty) są już wczytane. */
export function useEntryFormReady() {
  return [
    useQuery(taskTypesQuery),
    useQuery(scaleQuery),
    useQuery(projectsQuery),
  ].every((q) => q.isSuccess)
}

/**
 * ViewModel formularza wpisu (VM w MVVM): dane z serwera, stan szkicu, walidacja,
 * zapis i start timera. Widok dostaje gotowe wartości i akcje, nie liczy niczego sam.
 * Przejścia stanu są czystymi funkcjami w `model.ts`.
 */
export function useEntryFormViewModel({
  workDate,
  entry = null,
  onSaved,
  prefill,
  copyOf = null,
}: EntryFormProps) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const uid = useId()
  const types = selectable(
    useQuery(taskTypesQuery).data ?? [],
    entry?.taskTypeId,
  )
  const projects = selectable(
    useQuery(projectsQuery).data ?? [],
    entry?.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const timeZone = useQuery(settingsQuery).data?.timezone
  const nowTime = () => nowTimeIn(timeZone)
  // Timer liczy czas od teraz, więc nowy wpis z timerem jest możliwy tylko dziś.
  const timerAllowed = workDate === todayIn(timeZone)
  const editing = entry !== null

  const [draft, setDraft] = useState<Draft>(() =>
    copyOf ? copyDraft(copyOf) : initialDraft(entry, types[0]),
  )
  const [submitted, setSubmitted] = useState(false)
  const [customFor, setCustomFor] = useState<TaskType | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = () => titleRef.current?.focus()

  // Zmiana dnia na przeszły w trakcie wypełniania: timer przechodzi na „czas trwania”.
  useEffect(() => {
    if (!timerAllowed && !editing && draft.mode === 'timer')
      setDraft((d) => ({ ...d, mode: 'duration' }))
  }, [timerAllowed, editing, draft.mode])

  // Wybór z wyszukiwarki lub palety: tylko przy nowym kluczu, nie przy każdym renderze.
  const prefillKey = prefill?.key
  useEffect(() => {
    if (!prefill) return
    setDraft((d) => withPrefill(d, prefill, { timerAllowed, now: nowTime() }))
    focusTitle()
    if (!prefill.entry) titleRef.current?.scrollIntoView({ block: 'center' })
  }, [prefillKey])

  const type = types.find((x) => x.id === draft.taskTypeId) ?? types[0]

  const save = useDataMutation(
    (input: TimeEntryInput) =>
      entry ? entriesApi.update(entry.id, input) : entriesApi.create(input),
    {
      invalidate: [entryKeys.all],
      success: entry
        ? t.form.updated
        : copyOf
          ? t.form.duplicated
          : t.form.saved,
      onSuccess: (saved) => {
        onSaved?.(saved)
        if (!editing) {
          setDraft((d) => afterSave(d, type))
          setSubmitted(false)
          focusTitle()
        }
      },
    },
  )

  const startTimer = useDataMutation(
    (input: TimerStartInput) => entriesApi.start(input),
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
        setDraft((d) => afterTimerStart(d, type))
        setSubmitted(false)
        focusTitle()
      },
    },
  )

  // Dane pochodne: wszystko, co widok pokazuje, liczone w jednym miejscu.
  const input = type
    ? toInput(
        { ...draft, taskTypeId: type.id },
        workDate,
        type.storyPointsRequirement,
      )
    : null
  const issues: Array<EntryIssue> =
    type && input ? validateEntry(input, type) : []
  if (
    draft.mode === 'timer' &&
    !issues.some((i) => i.field === 'time') &&
    isFutureStart(draft.start, nowTime())
  ) {
    issues.push({ field: 'time', code: 'future' })
  }
  const minutes = draftMinutes(draft)
  const chosenSp = draft.storyPoints === '' ? null : Number(draft.storyPoints)
  const startsTimer = draft.mode === 'timer' && !editing

  const messageFor = (issue: EntryIssue): string => {
    const group = t.issues[issue.field as keyof typeof t.issues] as
      Record<string, string> | undefined
    return group?.[issue.code] ?? t.issues.time.invalid
  }
  /** Komunikat błędu pola po pierwszej próbie zapisu (walidacja albo odpowiedź serwera). */
  const issueText = (field: EntryField) => {
    if (!submitted) return null
    const issue = issues.find((i) => i.field === field)
    if (issue) return messageFor(issue)
    return mutationFieldError(save.error, field)
  }
  const fieldId = (field: string) => `${uid}-${field}`
  /** aria-describedby: błąd pola i (opcjonalnie) jego podpowiedź. */
  const describedBy = (field: EntryField, hint?: boolean) =>
    [
      issueText(field) ? `${fieldId(field)}-error` : null,
      hint ? `${fieldId(field)}-hint` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }))

  const quickLog = (next: TaskType, value: number | 'timer') => {
    setDraft((d) => withQuickLog(d, next, value, { now: nowTime(), editing }))
    // Po zamknięciu menu/okna Radix oddaje fokus; tytuł przejmuje go chwilę później.
    window.setTimeout(focusTitle, 30)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!input) return
    if (issues.length > 0) {
      document.getElementById(fieldId(issues[0]!.field))?.focus()
      return
    }
    if (startsTimer) startTimer.mutate(toTimerInput(input))
    else save.mutate(input)
  }

  /** Ctrl/⌘+Enter zapisuje z dowolnego pola. */
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.currentTarget.requestSubmit()
    }
  }

  return {
    t,
    format,
    uid,
    fieldId,
    titleRef,
    // dane
    types,
    projects,
    type,
    draft,
    editing,
    timerAllowed,
    startsTimer,
    minutes,
    overtimeMinutes: input?.overtimeMinutes ?? null,
    suggestedSp: minutes ? suggestPoints(scale, minutes) : null,
    chosenSp,
    spOptions: scaleWithValue(scale, chosenSp),
    taskKey: draft.link ? extractTaskKey(draft.link) : null,
    timeOptions: timeModesFor(entry, timerAllowed).map((value) => ({
      value,
      label: t.form.timeModes[value],
    })),
    pending: save.isPending || startTimer.isPending,
    customFor,
    // walidacja
    issueText,
    describedBy,
    // akcje
    update,
    changeType: (next: TaskType) => setDraft((d) => withType(d, next, editing)),
    setMode: (mode: DraftMode) =>
      setDraft((d) =>
        withMode(d, mode, { now: nowTime(), entryStart: entry?.startTime }),
      ),
    startNow: () => update({ start: nowTime() }),
    quickLog,
    openCustom: setCustomFor,
    closeCustom: () => setCustomFor(null),
    submit,
    onKeyDown,
  }
}

export type EntryFormViewModel = ReturnType<typeof useEntryFormViewModel>
