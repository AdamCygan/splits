import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { projectInput } from '../data/inputs.server'
import {
  createProject,
  listProjects,
  setProjectArchived,
  updateProject,
} from '../data/repository.server'

export const projectRoutes = new Hono<AppEnv>()
  .get('/', async (context) =>
    context.json(await listProjects(scopeOf(context))),
  )
  .post('/', async (context) => {
    const input = await body(context, projectInput)
    return context.json(await createProject(scopeOf(context), input), 201)
  })
  .put('/:id', async (context) => {
    const input = await body(context, projectInput)
    return context.json(
      await updateProject(scopeOf(context), context.req.param('id'), input),
    )
  })
  .post('/:id/:action{archive|restore}', async (context) => {
    const archived = context.req.param('action') === 'archive'
    return context.json(
      await setProjectArchived(
        scopeOf(context),
        context.req.param('id'),
        archived,
      ),
    )
  })
