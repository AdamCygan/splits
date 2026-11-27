import { workBreakSchema } from './dto'
import type { WorkBreak, WorkBreakInput } from './dto'
import { timeEntrySchema } from '#/features/time-entries/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

/** Przerwy w pracy (nie są czasem pracy). */
export interface BreaksApi {
  list: (date: string) => R<Array<WorkBreak>>
  running: () => R<WorkBreak | null>
  /** Start przerwy; działający timer zadania zostaje wstrzymany. */
  start: () => R<{ break: WorkBreak; paused: TimeEntry | null }>
  /** Koniec przerwy; `resume` wznawia zadanie wstrzymane na jej czas. */
  end: (
    id: string,
    resume: boolean,
  ) => R<{ break: WorkBreak; resumed: TimeEntry | null }>
  add: (input: WorkBreakInput) => R<WorkBreak>
  remove: (id: string) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const breaksApi: BreaksApi = {
  list: (date) =>
    get(`/breaks?${new URLSearchParams({ date })}`, z.array(workBreakSchema)),
  running: () => get('/breaks/running', workBreakSchema.nullable()),
  start: () =>
    send(
      'POST',
      '/breaks/start',
      z.object({
        break: workBreakSchema,
        paused: timeEntrySchema.nullable(),
      }),
    ),
  end: (id, resume) =>
    send(
      'POST',
      `/breaks/${id}/end`,
      z.object({
        break: workBreakSchema,
        resumed: timeEntrySchema.nullable(),
      }),
      { resume },
    ),
  add: (input) => send('POST', '/breaks', workBreakSchema, input),
  remove: (id) => send('DELETE', `/breaks/${id}`, emptyResponse),
}
