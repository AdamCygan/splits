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
  .get('/', async (context) => context.json(await listTags(scopeOf(context))))
  .post('/', async (context) => {
    const input = await body(context, tagInput)
    const scope = scopeOf(context)
    const created = await mirrored(
      scope,
      applyOf(context),
      'tags',
      null,
      () => createTag(scope, input),
      (tag) => tag.id,
    )
    return context.json(created, 201)
  })
  .put('/:id', async (context) => {
    const input = await body(context, tagInput)
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'tags', id, () =>
        updateTag(scope, id, input),
      ),
    )
  })
  .delete('/:id', async (context) => {
    await removedEverywhere(
      scopeOf(context),
      applyOf(context),
      'tags',
      context.req.param('id'),
      removeTag,
    )
    return context.body(null, 204)
  })
