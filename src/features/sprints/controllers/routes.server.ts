import {
  applyOf,
  inTargets,
  mirrored,
  removedEverywhere,
} from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { cadenceInput, sprintInput } from '../data/inputs.server'
import {
  createSprint,
  getCadenceFor,
  getSprints,
  removeCadence,
  removeSprint,
  saveCadence,
  updateSprint,
} from '../data/repository.server'

export const sprintRoutes = new Hono<AppEnv>()
  .get('/cadence', async (c) => c.json(await getCadenceFor(scopeOf(c))))
  .put('/cadence', async (c) => {
    const input = await body(c, cadenceInput)
    return c.json(
      await inTargets(scopeOf(c), applyOf(c), (scope) =>
        saveCadence(scope, input),
      ),
    )
  })
  .delete('/cadence', async (c) => {
    await inTargets(scopeOf(c), applyOf(c), removeCadence)
    return c.json(null)
  })
  .get('/', async (c) => c.json(await getSprints(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, sprintInput)
    const scope = scopeOf(c)
    const created = await mirrored(
      scope,
      applyOf(c),
      'sprints',
      null,
      () => createSprint(scope, input),
      (r) => r.id,
    )
    return c.json(created, 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, sprintInput)
    const scope = scopeOf(c)
    const id = c.req.param('id')
    return c.json(
      await mirrored(scope, applyOf(c), 'sprints', id, () =>
        updateSprint(scope, id, input),
      ),
    )
  })
  .delete('/:id', async (c) => {
    await removedEverywhere(
      scopeOf(c),
      applyOf(c),
      'sprints',
      c.req.param('id'),
      removeSprint,
    )
    return c.body(null, 204)
  })
