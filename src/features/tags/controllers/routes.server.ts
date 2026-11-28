import {
  applyOf,
  mirrored,
  removedEverywhere,
} from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
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
  .get('/', async (c) => c.json(await listTags(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, tagInput)
    const scope = scopeOf(c)
    const created = await mirrored(
      scope,
      applyOf(c),
      'tags',
      null,
      () => createTag(scope, input),
      (r) => r.id,
    )
    return c.json(created, 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, tagInput)
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'tags', id, () =>
        updateTag(scope, id, input),
      ),
    )
  })
  .delete('/:id', async (c) => {
    await removedEverywhere(
      scopeOf(c),
      applyOf(c),
      'tags',
      c.req.param('id'),
      removeTag,
    )
    return c.body(null, 204)
  })
