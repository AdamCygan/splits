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
  .get('/', async (context) =>
    context.json(await listTaskTypes(scopeOf(context))),
  )
  .post('/', async (context) => {
    const input = cleanType(await body(context, taskTypeInput))
    const scope = scopeOf(context)
    const created = await mirrored(
      scope,
      applyOf(context),
      'workTypes',
      null,
      () => createTaskType(scope, input),
      (taskType) => taskType.id,
    )
    return context.json(created, 201)
  })
  .put('/:id', async (context) => {
    const input = cleanType(await body(context, taskTypeInput))
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'workTypes', id, () =>
        updateTaskType(scope, id, input),
      ),
    )
  })
  .post('/:id/:action{archive|restore}', async (context) => {
    const archived = context.req.param('action') === 'archive'
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'workTypes', id, () =>
        setTaskTypeArchived(scope, id, archived),
      ),
    )
  })
