import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body, idsInput } from '#/server/http/inputs'
import { templateInput } from '../data/inputs.server'
import {
  createTemplate,
  getTemplates,
  removeTemplate,
  reorderTemplates,
  updateTemplate,
} from '../data/repository.server'

export const templateRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getTemplates(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, templateInput)
    return c.json(await createTemplate(scopeOf(c), input), 201)
  })
  .put('/order', async (c) => {
    const { ids } = await body(c, idsInput)
    return c.json(await reorderTemplates(scopeOf(c), ids))
  })
  .put('/:id', async (c) => {
    const input = await body(c, templateInput)
    return c.json(await updateTemplate(scopeOf(c), c.req.param('id'), input))
  })
  .delete('/:id', async (c) => {
    await removeTemplate(scopeOf(c), c.req.param('id'))
    return c.body(null, 204)
  })
