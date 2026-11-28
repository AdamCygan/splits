import type { FieldRequirement, TaskType } from '#/features/task-types/data/dto'
import type {
  TimeEntry,
  TimeEntryInput,
} from '#/features/time-entries/data/dto'
import { isValidDate } from '#/shared/domain/dates'
import { TIME_RE } from '#/features/task-types/domain/rules'

/** Limity jak w bazie (tasks.title, tasks.external_url, time_entries.note). */
export const ENTRY_LIMITS = {
  title: 200,
  link: 2048,
  /** Notatka w Markdown (stare notatki miały limit 2000). */
  note: 20_000,
  overtimeNote: 1000,
  extensionNote: 1000,
  maxMinutes: 24 * 60,
  /** Estymata zadania: do 1000 godzin. */
  maxEstimate: 60_000,
} as const

/** Adres http(s) bez spacji: ta sama reguła w formularzach i na serwerze. */
export const URL_RE = /^https?:\/\/\S+$/i
export const isUrl = (value: string) => URL_RE.test(value.trim())
/** Adres do atrybutu href: tylko http(s). Inne schematy (javascript:, data:) dają undefined. */
export const safeUrl = (value: string | null | undefined) =>
  value && isUrl(value) ? value.trim() : undefined

export type EntryField =
  | 'title'
  | 'link'
  | 'time'
  | 'storyPoints'
  | 'note'
  | 'workDate'
  | 'overtime'
  | 'overtimeNote'
  | 'estimate'
  | 'extension'
  | 'extensionNote'
export type EntryIssueCode =
  | 'required'
  | 'too_long'
  | 'invalid_url'
  | 'time_order'
  | 'duration_range'
  | 'future'
  | 'over_duration'
  | 'running'
  | 'invalid'
export interface EntryIssue {
  field: EntryField
  code: EntryIssueCode
}

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

/** Minuty od północy → 'HH:MM'; wartości spoza doby zawijają się (−5 → 23:55, 1445 → 00:05). */
export const fromMinutes = (minutes: number) => {
  const minutesOfDay = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(minutesOfDay / 60)).padStart(2, '0')}:${String(minutesOfDay % 60).padStart(2, '0')}`
}

/** Czas między godzinami w obrębie dnia; null, gdy koniec nie jest po początku. */
export function minutesBetween(start: string, end: string): number | null {
  const isInvalidTime = !TIME_RE.test(start) || !TIME_RE.test(end)
  if (isInvalidTime) return null
  const diff = toMinutes(end) - toMinutes(start)
  return diff > 0 ? diff : null
}

/**
 * Czas trwania wpisany przez człowieka: "90", "1:30", "1h 30m", "1,5h", "45 min".
 * Zwraca minuty albo null, gdy nie da się odczytać.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(',', '.')
  if (!text) return null
  const isPlainMinutes = /^\d+$/.test(text)
  if (isPlainMinutes) return Number(text)
  const clock = text.match(/^(\d{1,2}):([0-5]\d)$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const parts = text.match(
    /^(?:(\d+(?:\.\d+)?)\s*(?:h|godz|hours?)\s*)?(?:(\d+)\s*(?:m|min|minutes?)?)?$/,
  )
  const isUnparsable = !parts || (!parts[1] && !parts[2])
  if (isUnparsable) return null
  const minutes = Math.round(Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0))
  return minutes > 0 ? minutes : null
}

const needs = (requirement: FieldRequirement, value: string | null) =>
  requirement === 'required' && !value?.trim()

type EntryTypeRules = Pick<
  TaskType,
  'linkRequirement' | 'descriptionRequirement' | 'storyPointsRequirement'
>

/**
 * Walidacja wpisu dla danego typu pracy. Te same reguły stosuje formularz,
 * źródło demo i API (FluentValidation + CHECK w bazie). Każde pole ma własną
 * funkcję; kolejność błędów odpowiada kolejności pól w formularzu.
 */
export function validateEntry(
  input: TimeEntryInput,
  type: EntryTypeRules,
): Array<EntryIssue> {
  return [
    titleIssue(input),
    linkIssue(input, type),
    noteIssue(input, type),
    timeIssue(input),
    storyPointsIssue(input, type),
    workDateIssue(input),
    ...overtimeIssues(input),
    estimateIssue(input),
    ...extensionIssues(input),
  ].filter((issue): issue is EntryIssue => issue !== null)
}

function titleIssue(input: TimeEntryInput): EntryIssue | null {
  const title = input.title.trim()
  if (!title) return { field: 'title', code: 'required' }
  const isTitleTooLong = title.length > ENTRY_LIMITS.title
  return isTitleTooLong ? { field: 'title', code: 'too_long' } : null
}

function linkIssue(
  input: TimeEntryInput,
  type: EntryTypeRules,
): EntryIssue | null {
  const isMissingLink = needs(type.linkRequirement, input.link)
  if (isMissingLink) return { field: 'link', code: 'required' }
  const link = input.link?.trim() ?? ''
  if (!link) return null
  const isLinkTooLong = (input.link?.length ?? 0) > ENTRY_LIMITS.link
  if (isLinkTooLong) return { field: 'link', code: 'too_long' }
  const isInvalidLink = !URL_RE.test(link)
  return isInvalidLink ? { field: 'link', code: 'invalid_url' } : null
}

function noteIssue(
  input: TimeEntryInput,
  type: EntryTypeRules,
): EntryIssue | null {
  const isMissingNote = needs(type.descriptionRequirement, input.note)
  if (isMissingNote) return { field: 'note', code: 'required' }
  const isNoteTooLong = (input.note?.length ?? 0) > ENTRY_LIMITS.note
  return isNoteTooLong ? { field: 'note', code: 'too_long' } : null
}

function timeIssue(input: TimeEntryInput): EntryIssue | null {
  const { startTime, endTime, durationMinutes } = input
  // Timer: jest godzina startu, nie ma końca; czas liczy się do zatrzymania.
  if (input.running) {
    const isInvalidTimer =
      !startTime || !TIME_RE.test(startTime) || endTime !== null
    return isInvalidTimer ? { field: 'time', code: 'invalid' } : null
  }
  const hasTimeRange = startTime !== null || endTime !== null
  if (hasTimeRange) {
    const span =
      startTime && endTime ? minutesBetween(startTime, endTime) : null
    const isInvalidRange = span === null
    if (isInvalidRange) return { field: 'time', code: 'time_order' }
    const isDurationMismatch = span !== durationMinutes
    return isDurationMismatch ? { field: 'time', code: 'invalid' } : null
  }
  const isInvalidDuration =
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > ENTRY_LIMITS.maxMinutes
  return isInvalidDuration ? { field: 'time', code: 'duration_range' } : null
}

function storyPointsIssue(
  input: TimeEntryInput,
  type: EntryTypeRules,
): EntryIssue | null {
  const { storyPoints } = input
  const hidesStoryPoints = type.storyPointsRequirement === 'hidden'
  if (hidesStoryPoints) {
    const hasStoryPoints = storyPoints !== null
    return hasStoryPoints ? { field: 'storyPoints', code: 'invalid' } : null
  }
  const isUnestimated = storyPoints === null
  if (isUnestimated) {
    const requiresStoryPoints = type.storyPointsRequirement === 'required'
    return requiresStoryPoints
      ? { field: 'storyPoints', code: 'required' }
      : null
  }
  const isOutOfRange = !(storyPoints > 0 && storyPoints <= 100)
  return isOutOfRange ? { field: 'storyPoints', code: 'invalid' } : null
}

function workDateIssue(input: TimeEntryInput): EntryIssue | null {
  const isInvalidDate = !isValidDate(input.workDate)
  return isInvalidDate ? { field: 'workDate', code: 'invalid' } : null
}

/** Nadgodziny: część czasu wpisu, zawsze z opisem; działający timer jeszcze nie ma czasu. */
function overtimeIssues(input: TimeEntryInput): Array<EntryIssue | null> {
  const overtime = input.overtimeMinutes
  const note = input.overtimeNote?.trim() ?? ''
  const hasNoOvertime = overtime === null
  if (hasNoOvertime)
    return [note ? { field: 'overtime', code: 'required' } : null]
  return [
    partIssue('overtime', overtime, input),
    noteForPartIssue('overtimeNote', note, ENTRY_LIMITS.overtimeNote),
  ]
}

function estimateIssue(input: TimeEntryInput): EntryIssue | null {
  const estimate = input.estimateMinutes ?? null
  const hasNoEstimate = estimate === null
  if (hasNoEstimate) return null
  const isInvalidEstimate =
    !Number.isInteger(estimate) ||
    estimate < 1 ||
    estimate > ENTRY_LIMITS.maxEstimate
  return isInvalidEstimate ? { field: 'estimate', code: 'invalid' } : null
}

/** Przedłużenie (np. spotkania): część czasu wpisu ponad plan, zawsze z powodem. */
function extensionIssues(input: TimeEntryInput): Array<EntryIssue | null> {
  const extension = input.extensionMinutes ?? null
  const note = input.extensionNote?.trim() ?? ''
  const hasNoExtension = extension === null
  if (hasNoExtension)
    return [note ? { field: 'extension', code: 'required' } : null]
  return [
    partIssue('extension', extension, input),
    noteForPartIssue('extensionNote', note, ENTRY_LIMITS.extensionNote),
  ]
}

/** Nadgodziny i przedłużenie: dodatnia liczba minut, nie więcej niż cały wpis. */
function partIssue(
  field: 'overtime' | 'extension',
  minutes: number,
  input: TimeEntryInput,
): EntryIssue | null {
  if (input.running) return { field, code: 'running' }
  const isInvalidMinutes = !Number.isInteger(minutes) || minutes < 1
  if (isInvalidMinutes) return { field, code: 'invalid' }
  const isLongerThanEntry = minutes > input.durationMinutes
  return isLongerThanEntry ? { field, code: 'over_duration' } : null
}

function noteForPartIssue(
  field: 'overtimeNote' | 'extensionNote',
  note: string,
  limit: number,
): EntryIssue | null {
  if (!note) return { field, code: 'required' }
  const isNoteTooLong = note.length > limit
  return isNoteTooLong ? { field, code: 'too_long' } : null
}

/** Start timera nie może być w przyszłości (porównanie w obrębie dnia, 'HH:MM'). */
export function isFutureStart(startTime: string, nowTime: string) {
  return TIME_RE.test(startTime) && toMinutes(startTime) > toMinutes(nowTime)
}

/** Moment startu (ISO) dla godziny startu podanej dziś: teraz minus różnica minut. */
export function startedAtFor(
  startTime: string,
  nowTime: string,
  now: Date = new Date(),
) {
  const back = Math.max(0, toMinutes(nowTime) - toMinutes(startTime))
  const at = new Date(now)
  at.setSeconds(0, 0)
  return new Date(at.getTime() - back * 60_000).toISOString()
}

export interface StoppableEntry {
  workDate: string
  startTime: string | null
  startedAt: string | null
}

/**
 * Wartości po zatrzymaniu timera. Ten sam dzień: koniec = teraz (minimum 1 minuta).
 * Po północy: zostaje sam czas trwania (maks. 24 h), bo przedział 'HH:MM' nie mieści dwóch dni.
 */
export function stoppedValues(
  entry: StoppableEntry,
  today: string,
  nowTime: string,
  now: Date = new Date(),
) {
  const start = entry.startTime ?? nowTime
  const isStartInFuture =
    today === entry.workDate && toMinutes(nowTime) > toMinutes(start)
  if (isStartInFuture) {
    return {
      running: false,
      startTime: start,
      endTime: nowTime,
      durationMinutes: toMinutes(nowTime) - toMinutes(start),
    }
  }
  const canEndLater = today === entry.workDate && toMinutes(start) < 24 * 60 - 1
  if (canEndLater) {
    const end = fromMinutes(toMinutes(start) + 1)
    return {
      running: false,
      startTime: start,
      endTime: end,
      durationMinutes: 1,
    }
  }
  const elapsed = entry.startedAt
    ? Math.round((now.getTime() - Date.parse(entry.startedAt)) / 60_000)
    : 1
  return {
    running: false,
    startTime: null,
    endTime: null,
    durationMinutes: Math.min(ENTRY_LIMITS.maxMinutes, Math.max(1, elapsed)),
  }
}

/** Sekundy od startu timera (do licznika na ekranie). */
export function elapsedSeconds(
  startedAt: string | null,
  now: number = Date.now(),
) {
  return startedAt
    ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
    : 0
}

/**
 * Wpis z nowym przedłużeniem. Plan = czas bez przedłużenia; nowy czas = plan + przedłużenie.
 * Wpis z godzinami przesuwa koniec; gdy wyszedłby poza północ, zostaje sam czas trwania.
 */
export function withExtension(
  entry: TimeEntry,
  extension: number | null,
  reason: string | null,
): TimeEntryInput {
  const planned = entry.durationMinutes - (entry.extensionMinutes ?? 0)
  const duration = planned + (extension ?? 0)
  const start =
    entry.startTime && entry.endTime ? toMinutes(entry.startTime) : null
  const fits = start !== null && start + duration <= 23 * 60 + 59
  return {
    taskTypeId: entry.taskTypeId,
    projectId: entry.projectId,
    title: entry.title,
    link: entry.link,
    storyPoints: entry.storyPoints,
    workDate: entry.workDate,
    startTime: fits ? entry.startTime : null,
    endTime: fits ? fromMinutes(start + duration) : null,
    durationMinutes: duration,
    note: entry.note,
    overtimeMinutes: entry.overtimeMinutes,
    overtimeNote: entry.overtimeNote,
    estimateMinutes: entry.estimateMinutes,
    extensionMinutes: extension,
    extensionNote: extension === null ? null : reason,
    running: false,
  }
}
