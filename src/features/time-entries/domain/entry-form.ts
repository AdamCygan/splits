import type { SpScaleStep } from '#/features/story-points/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import type {
  TimeEntry,
  TimeEntryInput,
  TimerStartInput,
} from '#/features/time-entries/data/dto'
import type { TimeInputMode } from '#/features/settings/data/dto'
import {
  fromMinutes,
  minutesBetween,
  parseDuration,
  toMinutes,
} from '#/features/time-entries/domain/entries'

/**
 * Model formularza wpisu (warstwa M w MVVM): stan szkicu i czyste przejścia między
 * stanami. Bez Reacta i bez sieci, więc każde przejście ma test jednostkowy.
 */

/** 'timer' = start bez godziny końca; zatrzymuje się później jednym kliknięciem. */
export type DraftMode = TimeInputMode | 'timer'

/** Zadanie z wyszukiwarki albo palety do wpisania w formularz (`key` zmienia się przy każdym wyborze). */
export interface EntryPrefill {
  key: number
  entry?: TimeEntry
  title?: string
  mode?: DraftMode
}

export interface Draft {
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

export const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120]

const LAST_MINUTE = 23 * 60 + 59

/** Teraz, zaokrąglone w dół do 5 minut (minuty od północy, czas lokalny przeglądarki). */
export function nowRounded(at: Date = new Date()) {
  return Math.floor((at.getHours() * 60 + at.getMinutes()) / 5) * 5
}

/** SP zaznaczone na start dla typu pracy; '' = bez SP. */
export function spDefault(type: TaskType | undefined) {
  if (!type || type.storyPointsRequirement === 'hidden') return ''
  return type.defaultStoryPoints === null ? '' : String(type.defaultStoryPoints)
}

/** Szkic z istniejącego wpisu (edycja) albo pusty dla typu pracy (nowy wpis). */
export function initialDraft(
  entry: TimeEntry | null,
  type: TaskType | undefined,
  now: number = nowRounded(),
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
  const end = Math.max(30, now)
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

/**
 * Szkic kopii: opis zadania, notatka i czas; bez nadgodzin i przedłużenia (dotyczą
 * oryginału). Wpis z godzinami dostaje kolejny przedział: od końca oryginału, tyle samo.
 */
export function copyDraft(source: TimeEntry): Draft {
  const base = initialDraft(source, undefined)
  const timed = source.startTime !== null && source.endTime !== null
  const start = timed ? toMinutes(source.endTime!) : 0
  const end = Math.min(start + source.durationMinutes, LAST_MINUTE)
  return {
    ...base,
    mode: timed && end > start ? 'range' : 'duration',
    start: timed ? fromMinutes(start) : '',
    end: timed ? fromMinutes(end) : '',
    overtime: false,
    overtimeDuration: '',
    overtimeNote: '',
    extensionMinutes: null,
    extensionNote: null,
  }
}

/** Minuty z bieżącego trybu czasu (null = jeszcze nie da się policzyć). */
export function draftMinutes(d: Draft) {
  if (d.mode === 'timer') return null
  return d.mode === 'range'
    ? minutesBetween(d.start, d.end)
    : parseDuration(d.duration)
}

/**
 * Nadgodziny z formularza. Wyłączone albo timer = brak nadgodzin.
 * Puste pole czasu przy włączonych nadgodzinach = cały czas wpisu.
 */
export function overtimeOf(
  d: Draft,
): Pick<TimeEntryInput, 'overtimeMinutes' | 'overtimeNote'> {
  if (!d.overtime || d.mode === 'timer')
    return { overtimeMinutes: null, overtimeNote: null }
  const minutes = d.overtimeDuration.trim()
    ? (parseDuration(d.overtimeDuration) ?? -1)
    : (draftMinutes(d) ?? -1)
  return { overtimeMinutes: minutes, overtimeNote: d.overtimeNote }
}

/** Szkic → dane do API (walidacja w domain/entries sprawdza je tak samo jak serwer). */
export function toInput(
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

/** Dane wpisu → start timera (bez końca, czasu trwania, nadgodzin i przedłużenia). */
export function toTimerInput(input: TimeEntryInput): TimerStartInput {
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

/** Zmiana typu pracy: tryb czasu z typu (gdy nic jeszcze nie wpisano) i domyślne SP (nowy wpis). */
export function withType(d: Draft, next: TaskType, editing: boolean): Draft {
  return {
    ...d,
    taskTypeId: next.id,
    mode: d.title || d.duration ? d.mode : next.defaultTimeInput,
    storyPoints: editing ? d.storyPoints : spDefault(next),
  }
}

export interface WithModeOptions {
  now: string
  entryStart?: string | null
}

/**
 * Zmiana sposobu podania czasu: timer zaczyna od teraz (albo od startu edytowanego
 * wpisu), a „czas trwania” przejmuje policzone już minuty z godzin.
 */
export function withMode(
  d: Draft,
  mode: DraftMode,
  options: WithModeOptions,
): Draft {
  const minutes = draftMinutes(d)
  return {
    ...d,
    mode,
    start:
      mode === 'timer' && d.mode !== 'timer'
        ? (options.entryStart ?? options.now)
        : d.start,
    duration:
      mode === 'duration' && !d.duration && minutes
        ? String(minutes)
        : d.duration,
  }
}

export interface WithQuickLogOptions {
  now: string
  editing: boolean
}

/** Szybki wpis z menu typu: typ i czas trwania (albo timer od teraz). */
export function withQuickLog(
  d: Draft,
  type: TaskType,
  minutes: number | 'timer',
  options: WithQuickLogOptions,
): Draft {
  const typed = withType(d, type, options.editing)
  return minutes === 'timer'
    ? { ...typed, mode: 'timer', start: options.now }
    : { ...typed, mode: 'duration', duration: String(minutes) }
}

export interface WithPrefillOptions {
  timerAllowed: boolean
  now: string
}

/**
 * Wybór z wyszukiwarki lub palety. Całe zadanie: tytuł, typ, link, projekt, SP
 * i estymata (czas zostaje). Sam tytuł i tryb (z palety): timer tylko, gdy wolno.
 */
export function withPrefill(
  d: Draft,
  prefill: EntryPrefill,
  options: WithPrefillOptions,
): Draft {
  const e = prefill.entry
  if (!e) {
    const mode =
      prefill.mode === 'timer' && !options.timerAllowed
        ? 'duration'
        : prefill.mode
    return {
      ...d,
      ...(prefill.title !== undefined ? { title: prefill.title } : {}),
      ...(mode ? { mode } : {}),
      ...(mode === 'timer' ? { start: options.now } : {}),
    }
  }
  return {
    ...d,
    taskTypeId: e.taskTypeId,
    title: e.title,
    link: e.link ?? '',
    projectId: e.projectId ?? '',
    storyPoints: e.storyPoints === null ? '' : String(e.storyPoints),
    estimate: e.estimateMinutes === null ? '' : String(e.estimateMinutes),
  }
}

/**
 * Szkic po zapisie nowego wpisu: zostaje typ, projekt i tryb, a następny wpis
 * z godzinami zaczyna się tam, gdzie skończył się poprzedni (+30 min).
 */
export function afterSave(d: Draft, type: TaskType | undefined): Draft {
  const fresh = initialDraft(null, type)
  const continues = d.mode === 'range' && d.end !== ''
  return {
    ...fresh,
    taskTypeId: d.taskTypeId,
    projectId: d.projectId,
    mode: d.mode,
    start: continues ? d.end : fresh.start,
    end: continues
      ? fromMinutes(Math.min(toMinutes(d.end) + 30, 23 * 60 + 55))
      : fresh.end,
  }
}

/** Szkic po starcie timera: zostaje typ i projekt, następny wpis jako czas trwania. */
export function afterTimerStart(d: Draft, type: TaskType | undefined): Draft {
  return {
    ...initialDraft(null, type),
    taskTypeId: d.taskTypeId,
    projectId: d.projectId,
    mode: 'duration',
  }
}

/** Dostępne sposoby podania czasu: timer tylko dla nowego wpisu dziś albo działającego. */
export function timeModesFor(
  entry: TimeEntry | null,
  timerAllowed: boolean,
): ReadonlyArray<DraftMode> {
  if (entry) return entry.running ? ['timer', 'range'] : ['range', 'duration']
  return timerAllowed ? ['range', 'duration', 'timer'] : ['range', 'duration']
}

/** Skala z dodaną wartością wpisu, gdy skala zmieniła się po jego zapisaniu. */
export function scaleWithValue(
  scale: ReadonlyArray<SpScaleStep>,
  points: number | null,
): Array<SpScaleStep> {
  if (points === null || scale.some((s) => s.points === points))
    return [...scale]
  return [...scale, { id: 'current', points, maxMinutes: 0 }].sort(
    (a, b) => a.points - b.points,
  )
}
