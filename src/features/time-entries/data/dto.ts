import { z } from '#/lib/zod'
import { dateSchema, idSchema } from '#/shared/data/dto'

/** Kontrakt API (time-entries): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

/**
 * Wpis czasu. Tytuł, link i SP opisują zadanie (w API: tabela tasks, wpis wskazuje task_id),
 * a notatka należy do wpisu: co konkretnie zostało zrobione w tym czasie.
 */
export interface TimeEntry {
  id: string
  taskTypeId: string
  projectId: string | null
  title: string
  link: string | null
  /** null = wpis bez SP (dozwolone, gdy typ ma SP opcjonalne albo ukryte). */
  storyPoints: number | null
  /** Dzień w strefie użytkownika (YYYY-MM-DD). */
  workDate: string
  /** 'HH:MM' albo null, gdy wpis podano jako sam czas trwania. */
  startTime: string | null
  endTime: string | null
  /** Dla działającego timera 0 — czas liczy się od `startedAt`. */
  durationMinutes: number
  note: string | null
  /**
   * Nadgodziny: ile minut z `durationMinutes` przypada po godzinach (null = brak).
   * Zawsze razem z opisem, co wtedy było robione. Tylko dla zakończonych wpisów.
   */
  overtimeMinutes: number | null
  overtimeNote: string | null
  /**
   * Estymata całego zadania w minutach, podana przed pracą (null = brak). Jak SP należy do
   * zadania: raport porównuje ją z łącznym czasem wszystkich sesji.
   */
  estimateMinutes: number | null
  /**
   * Przedłużenie: ile minut z `durationMinutes` wyszło ponad plan (np. spotkanie na 1 h trwało
   * 1 h 20 min) i dlaczego. Zawsze razem z powodem; tylko dla zakończonych wpisów.
   */
  extensionMinutes: number | null
  extensionNote: string | null
  /** Kiedy zadanie oznaczono jako zakończone (ISO); null = w toku. */
  finishedAt: string | null
  /** Timer działa: jest start, nie ma końca. Najwyżej jeden naraz. */
  running: boolean
  /** Sesja przerwana (przełączenie na inne zadanie albo „Wstrzymaj”): zadanie czeka na „Wznów”. */
  paused: boolean
  /** Dokładny moment startu (ISO), tylko dla wpisów z timera. */
  startedAt: string | null
  createdAt: string
}

export type TimeEntryInput = Omit<
  TimeEntry,
  'id' | 'createdAt' | 'startedAt' | 'paused' | 'finishedAt'
>

/** Start timera: wszystko jak we wpisie, ale tylko godzina startu (domyślnie „teraz”). */
export type TimerStartInput = Omit<
  TimeEntryInput,
  | 'endTime'
  | 'durationMinutes'
  | 'running'
  | 'startTime'
  | 'overtimeMinutes'
  | 'overtimeNote'
  | 'extensionMinutes'
  | 'extensionNote'
  | 'estimateMinutes'
> & { startTime: string; estimateMinutes?: number | null }

export type TaskRef = Pick<TimeEntry, 'title' | 'link' | 'taskTypeId'>

/** Zmiana zadania we wszystkich jego wpisach. */
export type TaskUpdateInput = Pick<
  TimeEntry,
  'title' | 'link' | 'projectId' | 'storyPoints'
> & { estimateMinutes?: number | null }

export interface TimerStartResult {
  started: TimeEntry
  stopped: TimeEntry | null
}

/** Zadanie z wyszukiwarki: najświeższa sesja, sumy i stan (zakończone / trwa). */
export type TaskSearchResult = UnfinishedTask & {
  finished: boolean
  running: boolean
}

/** Zadanie z poprzednich dni, którego nie zakończono (lista „Do dokończenia”). */
export interface UnfinishedTask {
  /** Najświeższa sesja zadania (z niej „Kontynuuj” startuje nową sesję). */
  entry: TimeEntry
  /** Cały przepracowany czas zadania (wszystkie sesje). */
  workedMinutes: number
  sessions: number
  /** Ostatni dzień pracy nad zadaniem (YYYY-MM-DD). */
  lastDate: string
}

export const timeEntrySchema = z.object({
  id: idSchema,
  taskTypeId: idSchema,
  projectId: idSchema.nullable(),
  title: z.string(),
  link: z.string().nullable(),
  storyPoints: z.number().nullable(),
  workDate: dateSchema,
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().int(),
  note: z.string().nullable(),
  overtimeMinutes: z.number().int().nullable().default(null),
  overtimeNote: z.string().nullable().default(null),
  estimateMinutes: z.number().int().nullable().default(null),
  extensionMinutes: z.number().int().nullable().default(null),
  extensionNote: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  running: z.boolean(),
  paused: z.boolean(),
  startedAt: z.string().nullable(),
  createdAt: z.string(),
})
