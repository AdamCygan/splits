import { taskTypeSchema } from './dto'
import type { TaskType, TaskTypeInput } from './dto'
import { z } from '#/lib/zod'
import { get, send, archive } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface TaskTypesApi {
  list: () => R<Array<TaskType>>
  create: (input: TaskTypeInput) => R<TaskType>
  update: (id: string, input: TaskTypeInput) => R<TaskType>
  setArchived: (id: string, archived: boolean) => R<TaskType>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const taskTypesApi: TaskTypesApi = {
  list: () => get('/task-types', z.array(taskTypeSchema)),
  create: (input) => send('POST', '/task-types', taskTypeSchema, input),
  update: (id, input) =>
    send('PUT', `/task-types/${id}`, taskTypeSchema, input),
  setArchived: (id, archived) =>
    archive('task-types', id, archived, taskTypeSchema),
}
