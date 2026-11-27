import { projectSchema } from './dto'
import type { Project, ProjectInput } from './dto'
import { z } from '#/lib/zod'
import { get, send, archive } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface ProjectsApi {
  list: () => R<Array<Project>>
  create: (input: ProjectInput) => R<Project>
  update: (id: string, input: ProjectInput) => R<Project>
  setArchived: (id: string, archived: boolean) => R<Project>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const projectsApi: ProjectsApi = {
  list: () => get('/projects', z.array(projectSchema)),
  create: (input) => send('POST', '/projects', projectSchema, input),
  update: (id, input) => send('PUT', `/projects/${id}`, projectSchema, input),
  setArchived: (id, archived) =>
    archive('projects', id, archived, projectSchema),
}
