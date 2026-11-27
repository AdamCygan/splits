import { templateSchema } from './dto'
import type { QuickTemplate, QuickTemplateInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface TemplatesApi {
  list: () => R<Array<QuickTemplate>>
  create: (input: QuickTemplateInput) => R<QuickTemplate>
  update: (id: string, input: QuickTemplateInput) => R<QuickTemplate>
  reorder: (ids: Array<string>) => R<Array<QuickTemplate>>
  remove: (id: string) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const templatesApi: TemplatesApi = {
  list: () => get('/quick-templates', z.array(templateSchema)),
  create: (input) => send('POST', '/quick-templates', templateSchema, input),
  update: (id, input) =>
    send('PUT', `/quick-templates/${id}`, templateSchema, input),
  reorder: (ids) =>
    send('PUT', '/quick-templates/order', z.array(templateSchema), { ids }),
  remove: (id) => send('DELETE', `/quick-templates/${id}`, emptyResponse),
}
