import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { settingsInput } from '../data/inputs.server'
import { getSettings, updateSettings } from '../data/repository.server'

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getSettings(c.get('userId'))))
  .put('/', async (c) => {
    const input = await body(c, settingsInput)
    return c.json(await updateSettings(c.get('userId'), input))
  })
