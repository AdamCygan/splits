import { statusSchema } from './dto'
import type { TaskStatus, TaskStatusInput } from './dto'
import { z } from '#/lib/zod'
import { get, send, archive } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface StatusesApi {
  list: () => R<Array<TaskStatus>>
  create: (input: TaskStatusInput) => R<TaskStatus>
  update: (id: string, input: TaskStatusInput) => R<TaskStatus>
  reorder: (ids: Array<string>) => R<Array<TaskStatus>>
  setDefault: (id: string) => R<Array<TaskStatus>>
  setArchived: (id: string, archived: boolean) => R<TaskStatus>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const statusesApi: StatusesApi = {
  list: () => get('/task-statuses', z.array(statusSchema)),
  create: (input) => send('POST', '/task-statuses', statusSchema, input),
  update: (id, input) =>
    send('PUT', `/task-statuses/${id}`, statusSchema, input),
  reorder: (ids) =>
    send('PUT', '/task-statuses/order', z.array(statusSchema), { ids }),
  setDefault: (id) =>
    send('POST', `/task-statuses/${id}/default`, z.array(statusSchema)),
  setArchived: (id, archived) =>
    archive('task-statuses', id, archived, statusSchema),
}
