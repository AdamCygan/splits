import { taskTypeSchema } from './dto'
import type { TaskType, TaskTypeInput } from './dto'
import { z } from '#/lib/zod'
import { get, send, archive, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

export interface TaskTypesApi {
  list: () => R<Array<TaskType>>
  create: (input: TaskTypeInput, apply?: ApplyTo) => R<TaskType>
  update: (id: string, input: TaskTypeInput, apply?: ApplyTo) => R<TaskType>
  setArchived: (id: string, archived: boolean, apply?: ApplyTo) => R<TaskType>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const taskTypesApi: TaskTypesApi = {
  list: () => get('/task-types', z.array(taskTypeSchema)),
  create: (input, apply) =>
    send('POST', withApply('/task-types', apply), taskTypeSchema, input),
  update: (id, input, apply) =>
    send('PUT', withApply(`/task-types/${id}`, apply), taskTypeSchema, input),
  setArchived: (id, archived, apply) =>
    archive('task-types', id, archived, taskTypeSchema, apply),
}
