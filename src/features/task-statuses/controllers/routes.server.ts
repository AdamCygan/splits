import { applyOf, mirrored } from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body, idsInput } from '#/server/http/inputs'
import { statusInput } from '../data/inputs.server'
import {
  createStatus,
  getStatuses,
  reorderStatuses,
  setDefaultStatus,
  setStatusArchived,
  updateStatus,
} from '../data/repository.server'

export const statusRoutes = new Hono<AppEnv>()
  .get('/', async (context) =>
    context.json(await getStatuses(scopeOf(context))),
  )
  .post('/', async (context) => {
    const input = await body(context, statusInput)
    const scope = scopeOf(context)
    const created = await mirrored(
      scope,
      applyOf(context),
      'statuses',
      null,
      () => createStatus(scope, input),
      (taskStatus) => taskStatus.id,
    )
    return context.json(created, 201)
  })
  .put('/order', async (context) => {
    const { ids } = await body(context, idsInput)
    return context.json(await reorderStatuses(scopeOf(context), ids))
  })
  .put('/:id', async (context) => {
    const input = await body(context, statusInput)
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'statuses', id, () =>
        updateStatus(scope, id, input),
      ),
    )
  })
  .post('/:id/default', async (context) => {
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'statuses', id, () =>
        setDefaultStatus(scope, id),
      ),
    )
  })
  .post('/:id/:action{archive|restore}', async (context) => {
    const archived = context.req.param('action') === 'archive'
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'statuses', id, () =>
        setStatusArchived(scope, id, archived),
      ),
    )
  })
