import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { tagInput } from '../data/inputs.server'
import {
  createTag,
  listTags,
  removeTag,
  updateTag,
} from '../data/repository.server'

export const tagRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listTags(c.get('userId'))))
  .post('/', async (c) => {
    const input = await body(c, tagInput)
    return c.json(await createTag(c.get('userId'), input), 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, tagInput)
    return c.json(await updateTag(c.get('userId'), c.req.param('id'), input))
  })
  .delete('/:id', async (c) => {
    await removeTag(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
