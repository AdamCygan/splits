import { Hono } from 'hono'
import { db } from '#/server/db/client'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { cadenceInput, sprintInput } from '../data/inputs.server'
import {
  createSprint,
  getCadence,
  getSprints,
  removeCadence,
  removeSprint,
  saveCadence,
  updateSprint,
} from '../data/repository.server'

export const sprintRoutes = new Hono<AppEnv>()
  .get('/cadence', async (c) => c.json(await getCadence(db, c.get('userId'))))
  .put('/cadence', async (c) => {
    const input = await body(c, cadenceInput)
    return c.json(await saveCadence(c.get('userId'), input))
  })
  .delete('/cadence', async (c) => {
    await removeCadence(c.get('userId'))
    return c.json(null)
  })
  .get('/', async (c) => c.json(await getSprints(c.get('userId'))))
  .post('/', async (c) => {
    const input = await body(c, sprintInput)
    return c.json(await createSprint(c.get('userId'), input), 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, sprintInput)
    return c.json(await updateSprint(c.get('userId'), c.req.param('id'), input))
  })
  .delete('/:id', async (c) => {
    await removeSprint(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
