import { taskTypeInput } from '../data/inputs.server'
import { toTaskType } from '../data/mappers.server'
import {
  assertTypeSlot,
  assertUniqueTypeName,
  cleanType,
  ownTaskType,
} from '../data/repository.server'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { conflict, notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

export const taskTypeRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await db
      .select()
      .from(t.taskTypes)
      .where(eq(t.taskTypes.userId, c.get('userId')))
      .orderBy(asc(t.taskTypes.sortOrder))
    return c.json(rows.map(toTaskType))
  })
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = cleanType(await body(c, taskTypeInput))
    const row = await db.transaction(async (tx) => {
      await assertUniqueTypeName(tx, userId, input.name)
      await assertTypeSlot(tx, userId)
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(t.taskTypes)
        .where(eq(t.taskTypes.userId, userId))
      const [created] = await tx
        .insert(t.taskTypes)
        .values({
          ...input,
          userId,
          kind: 'custom',
          isSystem: false,
          sortOrder: n,
        })
        .returning()
      return created!
    })
    return c.json(toTaskType(row), 201)
  })
  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = cleanType(await body(c, taskTypeInput))
    const row = await db.transaction(async (tx) => {
      if (!(await ownTaskType(tx, userId, id))) throw notFound()
      await assertUniqueTypeName(tx, userId, input.name, id)
      const [updated] = await tx
        .update(t.taskTypes)
        .set(input)
        .where(eq(t.taskTypes.id, id))
        .returning()
      return updated!
    })
    return c.json(toTaskType(row))
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const archived = c.req.param('action') === 'archive'
    const row = await db.transaction(async (tx) => {
      const type = await ownTaskType(tx, userId, id)
      if (!type) throw notFound()
      if (type.isSystem && archived) throw conflict('type.system_archive')
      if (!archived && !type.isSystem && type.archivedAt)
        await assertTypeSlot(tx, userId)
      const [updated] = await tx
        .update(t.taskTypes)
        .set({ archivedAt: archived ? new Date() : null })
        .where(eq(t.taskTypes.id, id))
        .returning()
      return updated!
    })
    return c.json(toTaskType(row))
  })
