import { applyOf, inTargets } from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { validateScale } from '../domain/sp-scale'
import { scaleInput } from '../data/inputs.server'
import { getScale, replaceScale } from '../data/repository.server'

export const scaleRoutes = new Hono<AppEnv>()
  .get('/', async (context) => context.json(await getScale(scopeOf(context))))
  .put('/', async (context) => {
    const { steps } = await body(context, scaleInput)
    if (validateScale(steps).length > 0)
      throw new ApiError('scale.invalid', 400)
    return context.json(
      await inTargets(scopeOf(context), applyOf(context), (scope) =>
        replaceScale(scope, steps),
      ),
    )
  })
