import { day, time, uuid } from '#/server/http/inputs'
import { z } from 'zod'

const entryFields = {
  taskTypeId: uuid,
  projectId: uuid.nullable(),
  title: z.string().max(400),
  link: z.string().max(4096).nullable(),
  storyPoints: z.number().nullable(),
  workDate: day,
  note: z.string().max(40_000).nullable(),
  // Starsze klienty nie wysyłają estymaty: brak pola = brak estymaty.
  estimateMinutes: z.number().int().min(1).max(60000).nullable().default(null),
}

export const entryInput = z.object({
  ...entryFields,
  startTime: time.nullable(),
  endTime: time.nullable(),
  durationMinutes: z.number().int().min(0).max(1440),
  // Starsze klienty nie wysyłają nadgodzin: brak pola = brak nadgodzin.
  overtimeMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  overtimeNote: z.string().max(4000).nullable().default(null),
  extensionMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  extensionNote: z.string().max(4000).nullable().default(null),
  running: z.boolean(),
})

export const timerInput = z.object({ ...entryFields, startTime: time })

/** Zmiana zadania we wszystkich jego wpisach (tytuł, link, projekt, SP). */
export const taskUpdateInput = z.object({
  ref: z.object({
    taskTypeId: uuid,
    title: z.string().max(400),
    link: z.string().max(4096).nullable(),
  }),
  title: z.string().max(400),
  link: z.string().max(4096).nullable(),
  projectId: uuid.nullable(),
  storyPoints: z.number().nullable(),
  /** Brak pola = estymata bez zmian (starsze klienty). */
  estimateMinutes: z.number().int().min(1).max(60000).nullable().optional(),
})

/** Usunięcie całego zadania: wszystkie sesje albo tylko te z jednego dnia. */
export const taskDeleteInput = z.object({
  ref: z.object({
    taskTypeId: uuid,
    title: z.string().max(400),
    link: z.string().max(4096).nullable(),
  }),
  date: day.nullable().default(null),
})

export const noteInput = z.object({ note: z.string().max(40_000).nullable() })

export const taskFinishInput = z.object({
  ref: taskDeleteInput.shape.ref,
  finished: z.boolean(),
})

export const taskRefInput = z.object({
  taskTypeId: uuid,
  title: z.string().max(400),
  link: z.string().max(4096).optional(),
})
