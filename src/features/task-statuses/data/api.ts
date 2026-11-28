import { statusSchema } from './dto'
import type { TaskStatus, TaskStatusInput } from './dto'
import { z } from '#/lib/zod'
import { get, send, archive, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

export interface StatusesApi {
  list: () => R<Array<TaskStatus>>
  create: (input: TaskStatusInput, apply?: ApplyTo) => R<TaskStatus>
  update: (id: string, input: TaskStatusInput, apply?: ApplyTo) => R<TaskStatus>
  reorder: (ids: Array<string>) => R<Array<TaskStatus>>
  setDefault: (id: string, apply?: ApplyTo) => R<Array<TaskStatus>>
  setArchived: (id: string, archived: boolean, apply?: ApplyTo) => R<TaskStatus>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const statusesApi: StatusesApi = {
  list: () => get('/task-statuses', z.array(statusSchema)),
  create: (input, apply) =>
    send('POST', withApply('/task-statuses', apply), statusSchema, input),
  update: (id, input, apply) =>
    send('PUT', withApply(`/task-statuses/${id}`, apply), statusSchema, input),
  reorder: (ids) =>
    send('PUT', '/task-statuses/order', z.array(statusSchema), { ids }),
  setDefault: (id, apply) =>
    send(
      'POST',
      withApply(`/task-statuses/${id}/default`, apply),
      z.array(statusSchema),
    ),
  setArchived: (id, archived, apply) =>
    archive('task-statuses', id, archived, statusSchema, apply),
}
