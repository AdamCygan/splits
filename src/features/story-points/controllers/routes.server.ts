import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { validateScale } from '../domain/sp-scale'
import { scaleInput } from '../data/inputs.server'
import { getScale, replaceScale } from '../data/repository.server'

export const scaleRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getScale(c.get('userId'))))
  .put('/', async (c) => {
    const { steps } = await body(c, scaleInput)
    if (validateScale(steps).length > 0)
      throw new ApiError('scale.invalid', 400)
    return c.json(await replaceScale(c.get('userId'), steps))
  })
