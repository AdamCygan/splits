import { applyOf } from '#/features/workspaces/data/sync.server'
import { targetIds } from '#/features/workspaces/data/repository.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import { settingsInput } from '../data/inputs.server'
import { getSettings, updateSettings } from '../data/repository.server'

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (context) =>
    context.json(await getSettings(scopeOf(context))),
  )
  .put('/', async (context) => {
    const input = await body(context, settingsInput)
    const scope = scopeOf(context)
    // Dzień pracy (cel, dni robocze…) może trafić do wszystkich przestrzeni naraz.
    return context.json(
      await updateSettings(
        scope,
        input,
        await targetIds(scope, applyOf(context)),
      ),
    )
  })
