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
  .get('/', async (c) => c.json(await listProjects(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, projectInput)
    return c.json(await createProject(scopeOf(c), input), 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, projectInput)
    return c.json(await updateProject(scopeOf(c), c.req.param('id'), input))
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const archived = c.req.param('action') === 'archive'
    return c.json(
      await setProjectArchived(scopeOf(c), c.req.param('id'), archived),
    )
  })
