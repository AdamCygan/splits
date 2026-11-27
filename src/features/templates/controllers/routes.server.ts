import { templateInput } from '../data/inputs.server'
import { toTemplate } from '../data/mappers.server'
import {
  checkTemplate,
  listTemplates,
  templateCount,
} from '../data/repository.server'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import { reorder } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { notFound } from '#/server/http/errors'
import { body, idsInput } from '#/server/http/inputs'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const templateRoutes = new Hono<AppEnv>()
  .get('/', async (c) =>
    c.json((await listTemplates(db, c.get('userId'))).map(toTemplate)),
  )
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, templateInput)
    const row = await db.transaction(async (tx) => {
      await assertFreeSlot(
        userId,
        () => templateCount(tx, userId),
        FREE_LIMITS.quickTemplates,
        'plan.limit_templates',
      )
      await checkTemplate(tx, userId, input)
      const all = await listTemplates(tx, userId)
      const [created] = await tx
        .insert(t.quickTemplates)
        .values({ ...input, userId, sortOrder: all.length })
        .returning()
      return created!
    })
    return c.json(toTemplate(row), 201)
  })
  .put('/order', async (c) => {
    const userId = c.get('userId')
    const { ids } = await body(c, idsInput)
    const rows = await db.transaction(async (tx) => {
      await reorder(tx, t.quickTemplates, userId, ids)
      return listTemplates(tx, userId)
    })
    return c.json(rows.map(toTemplate))
  })
  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, templateInput)
    const row = await db.transaction(async (tx) => {
      await checkTemplate(tx, userId, input, id)
      const [updated] = await tx
        .update(t.quickTemplates)
        .set(input)
        .where(
          and(eq(t.quickTemplates.id, id), eq(t.quickTemplates.userId, userId)),
        )
        .returning()
      if (!updated) throw notFound()
      return updated
    })
    return c.json(toTemplate(row))
  })
  .delete('/:id', async (c) => {
    await db
      .delete(t.quickTemplates)
      .where(
        and(
          eq(t.quickTemplates.id, c.req.param('id')),
          eq(t.quickTemplates.userId, c.get('userId')),
        ),
      )
    return c.body(null, 204)
  })
