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
  .get('/cadence', async (context) =>
    context.json(await getCadenceFor(scopeOf(context))),
  )
  .put('/cadence', async (context) => {
    const input = await body(context, cadenceInput)
    return context.json(
      await inTargets(scopeOf(context), applyOf(context), (scope) =>
        saveCadence(scope, input),
      ),
    )
  })
  .delete('/cadence', async (context) => {
    await inTargets(scopeOf(context), applyOf(context), removeCadence)
    return context.json(null)
  })
  .get('/', async (context) => context.json(await getSprints(scopeOf(context))))
  .post('/', async (context) => {
    const input = await body(context, sprintInput)
    const scope = scopeOf(context)
    const created = await mirrored(
      scope,
      applyOf(context),
      'sprints',
      null,
      () => createSprint(scope, input),
      (sprint) => sprint.id,
    )
    return context.json(created, 201)
  })
  .put('/:id', async (context) => {
    const input = await body(context, sprintInput)
    const scope = scopeOf(context)
    const id = context.req.param('id')
    return context.json(
      await mirrored(scope, applyOf(context), 'sprints', id, () =>
        updateSprint(scope, id, input),
      ),
    )
  })
  .delete('/:id', async (context) => {
    await removedEverywhere(
      scopeOf(context),
      applyOf(context),
      'sprints',
      context.req.param('id'),
      removeSprint,
    )
    return context.body(null, 204)
  })
