import { applyOf } from '#/features/workspaces/data/sync.server'
import { targetIds } from '#/features/workspaces/data/repository.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { settingsInput } from '../data/inputs.server'
import { getSettings, updateSettings } from '../data/repository.server'

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getSettings(scopeOf(c))))
  .put('/', async (c) => {
    const input = await body(c, settingsInput)
    const scope = scopeOf(c)
    // Dzień pracy (cel, dni robocze…) może trafić do wszystkich przestrzeni naraz.
    return c.json(
      await updateSettings(scope, input, await targetIds(scope, applyOf(c))),
    )
  })
