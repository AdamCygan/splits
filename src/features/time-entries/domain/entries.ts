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
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

/** Minuty od północy → 'HH:MM'; wartości spoza doby zawijają się (−5 → 23:55, 1445 → 00:05). */
export const fromMinutes = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Czas między godzinami w obrębie dnia; null, gdy koniec nie jest po początku. */
export function minutesBetween(start: string, end: string): number | null {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null
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
  if (/^\d+$/.test(text)) return Number(text)
  const clock = text.match(/^(\d{1,2}):([0-5]\d)$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const parts = text.match(
    /^(?:(\d+(?:\.\d+)?)\s*(?:h|godz|hours?)\s*)?(?:(\d+)\s*(?:m|min|minutes?)?)?$/,
  )
  if (!parts || (!parts[1] && !parts[2])) return null
  const minutes = Math.round(Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0))
  return minutes > 0 ? minutes : null
}

const needs = (requirement: FieldRequirement, value: string | null) =>
  requirement === 'required' && !value?.trim()

/**
 * Walidacja wpisu dla danego typu pracy. Te same reguły stosuje formularz,
 * źródło demo i API (FluentValidation + CHECK w bazie).
 */
export function validateEntry(
  input: TimeEntryInput,
  type: Pick<
    TaskType,
    'linkRequirement' | 'descriptionRequirement' | 'storyPointsRequirement'
  >,
): Array<EntryIssue> {
  const issues: Array<EntryIssue> = []
  const title = input.title.trim()
  if (!title) issues.push({ field: 'title', code: 'required' })
  else if (title.length > ENTRY_LIMITS.title)
    issues.push({ field: 'title', code: 'too_long' })

  if (needs(type.linkRequirement, input.link))
    issues.push({ field: 'link', code: 'required' })
  else if (input.link?.trim()) {
    if (input.link.length > ENTRY_LIMITS.link)
      issues.push({ field: 'link', code: 'too_long' })
    else if (!URL_RE.test(input.link.trim()))
      issues.push({ field: 'link', code: 'invalid_url' })
  }

  if (needs(type.descriptionRequirement, input.note))
    issues.push({ field: 'note', code: 'required' })
  else if ((input.note?.length ?? 0) > ENTRY_LIMITS.note)
    issues.push({ field: 'note', code: 'too_long' })

  if (input.running) {
    // Timer: jest godzina startu, nie ma końca; czas liczy się do zatrzymania.
    if (
      !input.startTime ||
      !TIME_RE.test(input.startTime) ||
      input.endTime !== null
    )
      issues.push({ field: 'time', code: 'invalid' })
  } else if (input.startTime !== null || input.endTime !== null) {
    const span =
      input.startTime && input.endTime
        ? minutesBetween(input.startTime, input.endTime)
        : null
    if (span === null) issues.push({ field: 'time', code: 'time_order' })
    else if (span !== input.durationMinutes)
      issues.push({ field: 'time', code: 'invalid' })
  } else if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 1 ||
    input.durationMinutes > ENTRY_LIMITS.maxMinutes
  ) {
    issues.push({ field: 'time', code: 'duration_range' })
  }

  const sp = input.storyPoints
  if (type.storyPointsRequirement === 'hidden') {
    if (sp !== null) issues.push({ field: 'storyPoints', code: 'invalid' })
  } else if (sp === null) {
    if (type.storyPointsRequirement === 'required')
      issues.push({ field: 'storyPoints', code: 'required' })
  } else if (!(sp > 0 && sp <= 100)) {
    issues.push({ field: 'storyPoints', code: 'invalid' })
  }
  if (!isValidDate(input.workDate))
    issues.push({ field: 'workDate', code: 'invalid' })

  // Nadgodziny: część czasu wpisu, zawsze z opisem; działający timer jeszcze nie ma czasu.
  const overtime = input.overtimeMinutes
  if (overtime !== null) {
    if (input.running) issues.push({ field: 'overtime', code: 'running' })
    else if (!Number.isInteger(overtime) || overtime < 1)
      issues.push({ field: 'overtime', code: 'invalid' })
    else if (overtime > input.durationMinutes)
      issues.push({ field: 'overtime', code: 'over_duration' })
    const note = input.overtimeNote?.trim() ?? ''
    if (!note) issues.push({ field: 'overtimeNote', code: 'required' })
    else if (note.length > ENTRY_LIMITS.overtimeNote)
      issues.push({ field: 'overtimeNote', code: 'too_long' })
  } else if (input.overtimeNote?.trim()) {
    issues.push({ field: 'overtime', code: 'required' })
  }

  const estimate = input.estimateMinutes ?? null
  if (
    estimate !== null &&
    (!Number.isInteger(estimate) ||
      estimate < 1 ||
      estimate > ENTRY_LIMITS.maxEstimate)
  )
    issues.push({ field: 'estimate', code: 'invalid' })

  // Przedłużenie (np. spotkania): część czasu wpisu ponad plan, zawsze z powodem.
  const extension = input.extensionMinutes ?? null
  if (extension !== null) {
    if (input.running) issues.push({ field: 'extension', code: 'running' })
    else if (!Number.isInteger(extension) || extension < 1)
      issues.push({ field: 'extension', code: 'invalid' })
    else if (extension > input.durationMinutes)
      issues.push({ field: 'extension', code: 'over_duration' })
    const note = input.extensionNote?.trim() ?? ''
    if (!note) issues.push({ field: 'extensionNote', code: 'required' })
    else if (note.length > ENTRY_LIMITS.extensionNote)
      issues.push({ field: 'extensionNote', code: 'too_long' })
  } else if (input.extensionNote?.trim()) {
    issues.push({ field: 'extension', code: 'required' })
  }
  return issues
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
  if (today === entry.workDate && toMinutes(nowTime) > toMinutes(start)) {
    return {
      running: false,
      startTime: start,
      endTime: nowTime,
      durationMinutes: toMinutes(nowTime) - toMinutes(start),
    }
  }
  if (today === entry.workDate && toMinutes(start) < 24 * 60 - 1) {
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
