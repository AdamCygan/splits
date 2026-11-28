import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { selectable } from '#/shared/domain/archive'
import { entriesApi } from '../data/api'
import type { TaskType } from '#/features/task-types/data/dto'
import type {
  TimeEntry,
  TimeEntryInput,
  TimerStartInput,
} from '#/features/time-entries/data/dto'
import { nowTimeIn, todayIn } from '#/shared/domain/dates'
import {
  isFutureStart,
  validateEntry,
} from '#/features/time-entries/domain/entries'
import type {
  EntryField,
  EntryIssue,
} from '#/features/time-entries/domain/entries'
import { extractTaskKey } from '#/features/task-types/domain/rules'
import { suggestPoints } from '#/features/story-points/domain/sp-scale'
import { mutationFieldError, useDataMutation } from '#/shared/data/mutations'
import { projectsQuery } from '#/features/projects/data/queries'
import { scaleQuery } from '#/features/story-points/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { entryKeys } from '../data/queries'
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
} from '../domain/entry-form'
import type { Draft, DraftMode, EntryPrefill } from '../domain/entry-form'

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
  ].every((query) => query.isSuccess)
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
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const userId = useId()
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
    const isTimerNotAllowed =
      !timerAllowed && !editing && draft.mode === 'timer'
    if (isTimerNotAllowed)
      setDraft((currentDraft) => ({ ...currentDraft, mode: 'duration' }))
  }, [timerAllowed, editing, draft.mode])

  // Wybór z wyszukiwarki lub palety: tylko przy nowym kluczu, nie przy każdym renderze.
  const prefillKey = prefill?.key
  useEffect(() => {
    if (!prefill) return
    setDraft((currentDraft) =>
      withPrefill(currentDraft, prefill, { timerAllowed, now: nowTime() }),
    )
    focusTitle()
    if (!prefill.entry) titleRef.current?.scrollIntoView({ block: 'center' })
  }, [prefillKey])

  const type =
    types.find((archivable) => archivable.id === draft.taskTypeId) ?? types[0]

  const save = useDataMutation(
    (input: TimeEntryInput) =>
      entry ? entriesApi.update(entry.id, input) : entriesApi.create(input),
    {
      invalidate: [entryKeys.all],
      success: entry
        ? messages.form.updated
        : copyOf
          ? messages.form.duplicated
          : messages.form.saved,
      onSuccess: (saved) => {
        onSaved?.(saved)
        if (!editing) {
          setDraft((currentDraft) => afterSave(currentDraft, type))
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
      success: messages.form.timerStarted,
      onSuccess: (result) => {
        if (result.stopped) {
          toast(
            fmt(messages.form.previousStopped, {
              name: result.stopped.title,
              time: format.minutes(result.stopped.durationMinutes),
            }),
          )
        }
        onSaved?.(result.started)
        setDraft((currentDraft) => afterTimerStart(currentDraft, type))
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
  const startsInFuture =
    draft.mode === 'timer' &&
    !issues.some((entryIssue) => entryIssue.field === 'time') &&
    isFutureStart(draft.start, nowTime())
  if (startsInFuture) {
    issues.push({ field: 'time', code: 'future' })
  }
  const minutes = draftMinutes(draft)
  const chosenSp = draft.storyPoints === '' ? null : Number(draft.storyPoints)
  const startsTimer = draft.mode === 'timer' && !editing

  const messageFor = (issue: EntryIssue): string => {
    const group = messages.issues[
      issue.field as keyof typeof messages.issues
    ] as Record<string, string> | undefined
    return group?.[issue.code] ?? messages.issues.time.invalid
  }
  /** Komunikat błędu pola po pierwszej próbie zapisu (walidacja albo odpowiedź serwera). */
  const issueText = (field: EntryField) => {
    if (!submitted) return null
    const issue = issues.find((entryIssue) => entryIssue.field === field)
    if (issue) return messageFor(issue)
    return mutationFieldError(save.error, field)
  }
  const fieldId = (field: string) => `${userId}-${field}`
  /** aria-describedby: błąd pola i (opcjonalnie) jego podpowiedź. */
  const describedBy = (field: EntryField, hint?: boolean) =>
    [
      issueText(field) ? `${fieldId(field)}-error` : null,
      hint ? `${fieldId(field)}-hint` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  const update = (patch: Partial<Draft>) =>
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }))

  const quickLog = (next: TaskType, value: number | 'timer') => {
    setDraft((currentDraft) =>
      withQuickLog(currentDraft, next, value, { now: nowTime(), editing }),
    )
    // Po zamknięciu menu/okna Radix oddaje fokus; tytuł przejmuje go chwilę później.
    window.setTimeout(focusTitle, 30)
  }

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (!input) return
    const hasIssues = issues.length > 0
    if (hasIssues) {
      document.getElementById(fieldId(issues[0]!.field))?.focus()
      return
    }
    if (startsTimer) startTimer.mutate(toTimerInput(input))
    else save.mutate(input)
  }

  /** Ctrl/⌘+Enter zapisuje z dowolnego pola. */
  const onKeyDown = (keyboardEvent: KeyboardEvent<HTMLFormElement>) => {
    const isSaveShortcut =
      keyboardEvent.key === 'Enter' &&
      (keyboardEvent.ctrlKey || keyboardEvent.metaKey)
    if (isSaveShortcut) {
      keyboardEvent.preventDefault()
      keyboardEvent.currentTarget.requestSubmit()
    }
  }

  return {
    messages,
    format,
    userId,
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
      label: messages.form.timeModes[value],
    })),
    pending: save.isPending || startTimer.isPending,
    customFor,
    // walidacja
    issueText,
    describedBy,
    // akcje
    update,
    changeType: (next: TaskType) =>
      setDraft((currentDraft) => withType(currentDraft, next, editing)),
    setMode: (mode: DraftMode) =>
      setDraft((currentDraft) =>
        withMode(currentDraft, mode, {
          now: nowTime(),
          entryStart: entry?.startTime,
        }),
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
