import { statusInput } from '../data/inputs.server'
import { toStatus } from '../data/mappers.server'
import {
  activeStatuses,
  assertNotLastInCategory,
  listStatuses,
  ownStatus,
} from '../data/repository.server'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import { lowerName, reorder } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { conflict, notFound } from '#/server/http/errors'
import { body, idsInput } from '#/server/http/inputs'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const statusRoutes = new Hono<AppEnv>()
  .get('/', async (c) =>
    c.json((await listStatuses(db, c.get('userId'))).map(toStatus)),
  )
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, statusInput)
    const row = await db.transaction(async (tx) => {
      await assertFreeSlot(
        userId,
        () => activeStatuses(tx, userId),
        FREE_LIMITS.statuses,
        'plan.limit_statuses',
      )
      const all = await listStatuses(tx, userId)
      if (all.some((s) => lowerName(s.name) === lowerName(input.name)))
        throw conflict('name_taken', 'name')
      const [created] = await tx
        .insert(t.taskStatuses)
        .values({ ...input, userId, sortOrder: all.length })
        .returning()
      return created!
    })
    return c.json(toStatus(row), 201)
  })
  .put('/order', async (c) => {
    const userId = c.get('userId')
    const { ids } = await body(c, idsInput)
    const rows = await db.transaction(async (tx) => {
      await reorder(tx, t.taskStatuses, userId, ids)
      return listStatuses(tx, userId)
    })
    return c.json(rows.map(toStatus))
  })
  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, statusInput)
    const row = await db.transaction(async (tx) => {
      const status = await ownStatus(tx, userId, id)
      const all = await listStatuses(tx, userId)
      if (
        all.some(
          (s) => s.id !== id && lowerName(s.name) === lowerName(input.name),
        )
      )
        throw conflict('name_taken', 'name')
      if (status.category !== input.category && !status.archivedAt)
        await assertNotLastInCategory(tx, status)
      const [updated] = await tx
        .update(t.taskStatuses)
        .set(input)
        .where(eq(t.taskStatuses.id, id))
        .returning()
      return updated!
    })
    return c.json(toStatus(row))
  })
  .post('/:id/default', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const rows = await db.transaction(async (tx) => {
      const status = await ownStatus(tx, userId, id)
      if (status.archivedAt) throw notFound()
      await tx
        .update(t.taskStatuses)
        .set({ isDefault: false })
        .where(eq(t.taskStatuses.userId, userId))
      await tx
        .update(t.taskStatuses)
        .set({ isDefault: true })
        .where(eq(t.taskStatuses.id, id))
      return listStatuses(tx, userId)
    })
    return c.json(rows.map(toStatus))
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const archived = c.req.param('action') === 'archive'
    const row = await db.transaction(async (tx) => {
      const status = await ownStatus(tx, userId, id)
      if (archived) {
        if (status.isSystem) throw conflict('status.system_archive')
        if (status.isDefault) throw conflict('status.default_archive')
        await assertNotLastInCategory(tx, status)
      } else if (status.archivedAt) {
        await assertFreeSlot(
          userId,
          () => activeStatuses(tx, userId),
          FREE_LIMITS.statuses,
          'plan.limit_statuses',
        )
      }
      const [updated] = await tx
        .update(t.taskStatuses)
        .set({ archivedAt: archived ? new Date() : null })
        .where(eq(t.taskStatuses.id, id))
        .returning()
      return updated!
    })
    return c.json(toStatus(row))
  })
