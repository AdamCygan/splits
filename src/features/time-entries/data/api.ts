import { timeEntrySchema } from './dto'
import type {
  TaskRef,
  TaskSearchResult,
  TaskUpdateInput,
  TimeEntry,
  TimeEntryInput,
  TimerStartInput,
  TimerStartResult,
  UnfinishedTask,
} from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface EntriesApi {
  /** Wpisy z jednego dnia (YYYY-MM-DD), od najnowszych. */
  list: (workDate: string) => R<Array<TimeEntry>>
  /** Wpisy z zakresu dni włącznie (YYYY-MM-DD), do raportów. */
  range: (from: string, to: string) => R<Array<TimeEntry>>
  create: (input: TimeEntryInput) => R<TimeEntry>
  update: (id: string, input: TimeEntryInput) => R<TimeEntry>
  remove: (id: string) => R<undefined>
  /** Wszystkie wpisy tego samego zadania (ten sam link, a bez linku ten sam tytuł i typ). */
  forTask: (ref: TaskRef) => R<Array<TimeEntry>>
  /** Zmienia tytuł, link, projekt i SP we wszystkich wpisach zadania; zwraca je od najstarszego. */
  updateTask: (ref: TaskRef, input: TaskUpdateInput) => R<Array<TimeEntry>>
  /** Zadanie zakończone albo z powrotem w toku (wszystkie sesje); zwraca liczbę sesji. */
  finishTask: (ref: TaskRef, finished: boolean) => R<{ updated: number }>
  /** Zadania (także zakończone) pasujące do tytułu albo linku, najnowsze najpierw. */
  search: (q: string) => R<Array<TaskSearchResult>>
  /** Paleta poleceń: cała historia, tytuł, link i notatki; fragment notatki przy trafieniu w nią. */
  searchAll: (
    q: string,
  ) => R<Array<TaskSearchResult & { snippet: string | null }>>
  /** Niezakończone zadania z poprzednich dni, najświeższe najpierw. */
  unfinished: () => R<Array<UnfinishedTask>>
  /** Zmienia samą notatkę wpisu (np. odhaczony checkbox). */
  updateNote: (id: string, note: string | null) => R<TimeEntry>
  /** Usuwa wszystkie sesje zadania (albo tylko z `date`); zwraca ich liczbę. */
  removeTask: (ref: TaskRef, date: string | null) => R<{ deleted: number }>
  /** Działający timer albo null. */
  running: () => R<TimeEntry | null>
  /** Startuje timer; poprzedni działający zatrzymuje się automatycznie. */
  start: (input: TimerStartInput) => R<TimerStartResult>
  /** Zatrzymuje timer teraz (czas serwera w strefie użytkownika); zadanie uznajemy za skończone. */
  stop: (id: string) => R<TimeEntry>
  /** Przerwa: sesja się kończy, zadanie trafia do wstrzymanych. */
  pause: (id: string) => R<TimeEntry>
  /** Nowa sesja tego samego zadania; działający timer innego zadania zostaje wstrzymany. */
  resume: (id: string) => R<TimerStartResult>
  /** Zadanie skończone: znika z listy wstrzymanych. */
  dismiss: (id: string) => R<undefined>
  /** Wstrzymane dziś zadania (najświeższe najpierw). */
  paused: () => R<Array<TimeEntry>>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const entriesApi: EntriesApi = {
  list: (workDate) =>
    get(
      `/time-entries?date=${encodeURIComponent(workDate)}`,
      z.array(timeEntrySchema),
    ),
  range: (from, to) =>
    get(
      `/time-entries?${new URLSearchParams({ from, to }).toString()}`,
      z.array(timeEntrySchema),
    ),
  create: (input) => send('POST', '/time-entries', timeEntrySchema, input),
  update: (id, input) =>
    send('PUT', `/time-entries/${id}`, timeEntrySchema, input),
  remove: (id) => send('DELETE', `/time-entries/${id}`, emptyResponse),
  forTask: (ref) =>
    get(
      `/time-entries/by-task?${new URLSearchParams({
        taskTypeId: ref.taskTypeId,
        title: ref.title,
        ...(ref.link ? { link: ref.link } : {}),
      }).toString()}`,
      z.array(timeEntrySchema),
    ),
  updateTask: (ref, input) =>
    send('PUT', '/time-entries/task', z.array(timeEntrySchema), {
      ref: {
        taskTypeId: ref.taskTypeId,
        title: ref.title,
        link: ref.link,
      },
      ...input,
    }),
  updateNote: (id, note) =>
    send('PATCH', `/time-entries/${id}/note`, timeEntrySchema, { note }),
  finishTask: (ref, finished) =>
    send(
      'POST',
      '/time-entries/task/finish',
      z.object({ updated: z.number() }),
      {
        ref: { taskTypeId: ref.taskTypeId, title: ref.title, link: ref.link },
        finished,
      },
    ),
  search: (q) =>
    get(
      `/time-entries/search?${new URLSearchParams({ q }).toString()}`,
      z.array(
        z.object({
          entry: timeEntrySchema,
          workedMinutes: z.number(),
          sessions: z.number(),
          lastDate: z.string(),
          finished: z.boolean(),
          running: z.boolean(),
        }),
      ),
    ),
  searchAll: (q) =>
    get(
      `/time-entries/search/all?${new URLSearchParams({ q }).toString()}`,
      z.array(
        z.object({
          entry: timeEntrySchema,
          workedMinutes: z.number(),
          sessions: z.number(),
          lastDate: z.string(),
          finished: z.boolean(),
          running: z.boolean(),
          snippet: z.string().nullable(),
        }),
      ),
    ),
  unfinished: () =>
    get(
      '/time-entries/unfinished',
      z.array(
        z.object({
          entry: timeEntrySchema,
          workedMinutes: z.number(),
          sessions: z.number(),
          lastDate: z.string(),
        }),
      ),
    ),
  removeTask: (ref, date) =>
    send(
      'POST',
      '/time-entries/task/delete',
      z.object({ deleted: z.number() }),
      {
        ref: { taskTypeId: ref.taskTypeId, title: ref.title, link: ref.link },
        date,
      },
    ),
  running: () => get('/time-entries/running', timeEntrySchema.nullable()),
  start: (input) =>
    send(
      'POST',
      '/time-entries/timer',
      z.object({
        started: timeEntrySchema,
        stopped: timeEntrySchema.nullable(),
      }),
      input,
    ),
  stop: (id) => send('POST', `/time-entries/${id}/stop`, timeEntrySchema),
  pause: (id) => send('POST', `/time-entries/${id}/pause`, timeEntrySchema),
  resume: (id) =>
    send(
      'POST',
      `/time-entries/${id}/resume`,
      z.object({
        started: timeEntrySchema,
        stopped: timeEntrySchema.nullable(),
      }),
    ),
  dismiss: (id) => send('POST', `/time-entries/${id}/dismiss`, emptyResponse),
  paused: () => get('/time-entries/paused', z.array(timeEntrySchema)),
}
