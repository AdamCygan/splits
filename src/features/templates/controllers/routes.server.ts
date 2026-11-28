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
  .get('/', async (context) =>
    context.json(await getTemplates(scopeOf(context))),
  )
  .post('/', async (context) => {
    const input = await body(context, templateInput)
    return context.json(await createTemplate(scopeOf(context), input), 201)
  })
  .put('/order', async (context) => {
    const { ids } = await body(context, idsInput)
    return context.json(await reorderTemplates(scopeOf(context), ids))
  })
  .put('/:id', async (context) => {
    const input = await body(context, templateInput)
    return context.json(
      await updateTemplate(scopeOf(context), context.req.param('id'), input),
    )
  })
  .delete('/:id', async (context) => {
    await removeTemplate(scopeOf(context), context.req.param('id'))
    return context.body(null, 204)
  })
