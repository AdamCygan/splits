import { cadenceSchema, sprintSchema } from './dto'
import type { Sprint, SprintCadence, SprintInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface SprintsApi {
  getCadence: () => R<SprintCadence | null>
  setCadence: (input: SprintCadence | null) => R<SprintCadence | null>
  list: () => R<Array<Sprint>>
  create: (input: SprintInput) => R<Sprint>
  update: (id: string, input: SprintInput) => R<Sprint>
  remove: (id: string) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const sprintsApi: SprintsApi = {
  getCadence: () => get('/sprints/cadence', cadenceSchema),
  setCadence: (input) =>
    input
      ? send('PUT', '/sprints/cadence', cadenceSchema, input)
      : send('DELETE', '/sprints/cadence', cadenceSchema),
  list: () => get('/sprints', z.array(sprintSchema)),
  create: (input) => send('POST', '/sprints', sprintSchema, input),
  update: (id, input) => send('PUT', `/sprints/${id}`, sprintSchema, input),
  remove: (id) => send('DELETE', `/sprints/${id}`, emptyResponse),
}
