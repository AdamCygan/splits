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
  .get('/', async (c) => c.json(await getStatuses(c.get('userId'))))
  .post('/', async (c) => {
    const input = await body(c, statusInput)
    return c.json(await createStatus(c.get('userId'), input), 201)
  })
  .put('/order', async (c) => {
    const { ids } = await body(c, idsInput)
    return c.json(await reorderStatuses(c.get('userId'), ids))
  })
  .put('/:id', async (c) => {
    const input = await body(c, statusInput)
    return c.json(await updateStatus(c.get('userId'), c.req.param('id'), input))
  })
  .post('/:id/default', async (c) =>
    c.json(await setDefaultStatus(c.get('userId'), c.req.param('id'))),
  )
  .post('/:id/:action{archive|restore}', async (c) => {
    const archived = c.req.param('action') === 'archive'
    return c.json(
      await setStatusArchived(c.get('userId'), c.req.param('id'), archived),
    )
  })
