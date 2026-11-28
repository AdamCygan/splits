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
  .get('/', async (c) => c.json(await getStatuses(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, statusInput)
    const scope = scopeOf(c)
    const created = await mirrored(
      scope,
      applyOf(c),
      'statuses',
      null,
      () => createStatus(scope, input),
      (r) => r.id,
    )
    return c.json(created, 201)
  })
  .put('/order', async (c) => {
    const { ids } = await body(c, idsInput)
    return c.json(await reorderStatuses(scopeOf(c), ids))
  })
  .put('/:id', async (c) => {
    const input = await body(c, statusInput)
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'statuses', id, () =>
        updateStatus(scope, id, input),
      ),
    )
  })
  .post('/:id/default', async (c) => {
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'statuses', id, () =>
        setDefaultStatus(scope, id),
      ),
    )
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const archived = c.req.param('action') === 'archive'
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'statuses', id, () =>
        setStatusArchived(scope, id, archived),
      ),
    )
  })
