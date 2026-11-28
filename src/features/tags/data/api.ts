import { tagSchema } from './dto'
import type { Tag, TagInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

export interface TagsApi {
  list: () => R<Array<Tag>>
  create: (input: TagInput, apply?: ApplyTo) => R<Tag>
  update: (id: string, input: TagInput, apply?: ApplyTo) => R<Tag>
  remove: (id: string, apply?: ApplyTo) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const tagsApi: TagsApi = {
  list: () => get('/tags', z.array(tagSchema)),
  create: (input, apply) =>
    send('POST', withApply('/tags', apply), tagSchema, input),
  update: (id, input, apply) =>
    send('PUT', withApply(`/tags/${id}`, apply), tagSchema, input),
  remove: (id, apply) =>
    send('DELETE', withApply(`/tags/${id}`, apply), emptyResponse),
}
