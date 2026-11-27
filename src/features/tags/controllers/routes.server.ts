import { tagInput } from '../data/inputs.server'
import { toTag } from '../data/mappers.server'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const tagRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await db
      .select()
      .from(t.tags)
      .where(eq(t.tags.userId, c.get('userId')))
      .orderBy(asc(t.tags.name))
    return c.json(rows.map(toTag))
  })
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, tagInput)
    const [created] = await db
      .insert(t.tags)
      .values({ ...input, userId })
      .returning()
    return c.json(toTag(created!), 201)
  })
  .put('/:id', async (c) => {
    const input = await body(c, tagInput)
    const [row] = await db
      .update(t.tags)
      .set(input)
      .where(
        and(
          eq(t.tags.id, c.req.param('id')),
          eq(t.tags.userId, c.get('userId')),
        ),
      )
      .returning()
    if (!row) throw notFound()
    return c.json(toTag(row))
  })
  .delete('/:id', async (c) => {
    await db
      .delete(t.tags)
      .where(
        and(
          eq(t.tags.id, c.req.param('id')),
          eq(t.tags.userId, c.get('userId')),
        ),
      )
    return c.body(null, 204)
  })
