import { tagSchema } from './dto'
import type { Tag, TagInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface TagsApi {
  list: () => R<Array<Tag>>
  create: (input: TagInput) => R<Tag>
  update: (id: string, input: TagInput) => R<Tag>
  remove: (id: string) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const tagsApi: TagsApi = {
  list: () => get('/tags', z.array(tagSchema)),
  create: (input) => send('POST', '/tags', tagSchema, input),
  update: (id, input) => send('PUT', `/tags/${id}`, tagSchema, input),
  remove: (id) => send('DELETE', `/tags/${id}`, emptyResponse),
}
