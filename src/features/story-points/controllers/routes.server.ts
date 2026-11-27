import { scaleInput } from '../data/inputs.server'
import { toScaleStep } from '../data/mappers.server'
import { validateScale } from '#/features/story-points/domain/sp-scale'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const scaleRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await db
      .select()
      .from(t.storyPointScale)
      .where(eq(t.storyPointScale.userId, c.get('userId')))
      .orderBy(asc(t.storyPointScale.points))
    return c.json(rows.map(toScaleStep))
  })
  .put('/', async (c) => {
    const userId = c.get('userId')
    const { steps } = await body(c, scaleInput)
    if (validateScale(steps).length > 0)
      throw new ApiError('scale.invalid', 400)
    const rows = await db.transaction(async (tx) => {
      await tx
        .delete(t.storyPointScale)
        .where(eq(t.storyPointScale.userId, userId))
      return tx
        .insert(t.storyPointScale)
        .values(steps.map((s) => ({ ...s, userId })))
        .returning()
    })
    return c.json(rows.sort((a, b) => a.points - b.points).map(toScaleStep))
  })
