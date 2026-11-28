import { applyOf, mirrored } from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { taskTypeInput } from '../data/inputs.server'
import {
  cleanType,
  createTaskType,
  listTaskTypes,
  setTaskTypeArchived,
  updateTaskType,
} from '../data/repository.server'

export const taskTypeRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listTaskTypes(scopeOf(c))))
  .post('/', async (c) => {
    const input = cleanType(await body(c, taskTypeInput))
    const scope = scopeOf(c)
    const created = await mirrored(
      scope,
      applyOf(c),
      'workTypes',
      null,
      () => createTaskType(scope, input),
      (r) => r.id,
    )
    return c.json(created, 201)
  })
  .put('/:id', async (c) => {
    const input = cleanType(await body(c, taskTypeInput))
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'workTypes', id, () =>
        updateTaskType(scope, id, input),
      ),
    )
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const archived = c.req.param('action') === 'archive'
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'workTypes', id, () =>
        setTaskTypeArchived(scope, id, archived),
      ),
    )
  })
