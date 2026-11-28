import { workspaceSchema, workspaceStateSchema } from './dto'
import type {
  Workspace,
  WorkspaceCopyInput,
  WorkspaceCreateInput,
  WorkspaceInput,
  WorkspacePrefs,
  WorkspaceState,
} from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface WorkspacesApi {
  state: () => R<WorkspaceState>
  create: (input: WorkspaceCreateInput) => R<Workspace>
  update: (id: string, input: WorkspaceInput) => R<Workspace>
  remove: (id: string) => R<undefined>
  reorder: (ids: Array<string>) => R<Array<Workspace>>
  /** Bieżąca przestrzeń tej przeglądarki (ciasteczko ustawia serwer). */
  setCurrent: (id: string) => R<WorkspaceState>
  copy: (id: string, input: WorkspaceCopyInput) => R<undefined>
  prefs: (input: Partial<WorkspacePrefs>) => R<WorkspaceState>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const workspacesApi: WorkspacesApi = {
  state: () => get('/workspaces', workspaceStateSchema),
  create: (input) => send('POST', '/workspaces', workspaceSchema, input),
  update: (id, input) =>
    send('PUT', `/workspaces/${id}`, workspaceSchema, input),
  remove: (id) => send('DELETE', `/workspaces/${id}`, emptyResponse),
  reorder: (ids) =>
    send('PUT', '/workspaces/order', z.array(workspaceSchema), { ids }),
  setCurrent: (id) =>
    send('PUT', '/workspaces/current', workspaceStateSchema, { id }),
  copy: (id, input) =>
    send('POST', `/workspaces/${id}/copy`, emptyResponse, input),
  prefs: (input) =>
    send('PUT', '/workspaces/prefs', workspaceStateSchema, input),
}
