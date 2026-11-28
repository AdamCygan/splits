import { cadenceSchema, sprintSchema } from './dto'
import type { Sprint, SprintCadence, SprintInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

export interface SprintsApi {
  getCadence: () => R<SprintCadence | null>
  setCadence: (
    input: SprintCadence | null,
    apply?: ApplyTo,
  ) => R<SprintCadence | null>
  list: () => R<Array<Sprint>>
  create: (input: SprintInput, apply?: ApplyTo) => R<Sprint>
  update: (id: string, input: SprintInput, apply?: ApplyTo) => R<Sprint>
  remove: (id: string, apply?: ApplyTo) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const sprintsApi: SprintsApi = {
  getCadence: () => get('/sprints/cadence', cadenceSchema),
  setCadence: (input, apply) =>
    input
      ? send('PUT', withApply('/sprints/cadence', apply), cadenceSchema, input)
      : send('DELETE', withApply('/sprints/cadence', apply), cadenceSchema),
  list: () => get('/sprints', z.array(sprintSchema)),
  create: (input, apply) =>
    send('POST', withApply('/sprints', apply), sprintSchema, input),
  update: (id, input, apply) =>
    send('PUT', withApply(`/sprints/${id}`, apply), sprintSchema, input),
  remove: (id, apply) =>
    send('DELETE', withApply(`/sprints/${id}`, apply), emptyResponse),
}
