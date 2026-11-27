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
  .get('/', async (c) => c.json(await listTaskTypes(c.get('userId'))))
  .post('/', async (c) => {
    const input = cleanType(await body(c, taskTypeInput))
    return c.json(await createTaskType(c.get('userId'), input), 201)
  })
  .put('/:id', async (c) => {
    const input = cleanType(await body(c, taskTypeInput))
    return c.json(
      await updateTaskType(c.get('userId'), c.req.param('id'), input),
    )
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const archived = c.req.param('action') === 'archive'
    return c.json(
      await setTaskTypeArchived(c.get('userId'), c.req.param('id'), archived),
    )
  })
