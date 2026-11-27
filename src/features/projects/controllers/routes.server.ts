import { projectInput } from '../data/inputs.server'
import { toProject } from '../data/mappers.server'
import {
  activeProjects,
  assertProjectUnique,
  ownProject,
} from '../data/repository.server'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const projectRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await db
      .select()
      .from(t.projects)
      .where(eq(t.projects.userId, c.get('userId')))
      .orderBy(asc(t.projects.name))
    return c.json(rows.map(toProject))
  })
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, projectInput)
    const row = await db.transaction(async (tx) => {
      await assertFreeSlot(
        userId,
        () => activeProjects(tx, userId),
        FREE_LIMITS.projects,
        'plan.limit_projects',
      )
      await assertProjectUnique(tx, userId, input)
      const [created] = await tx
        .insert(t.projects)
        .values({ ...input, userId })
        .returning()
      return created!
    })
    return c.json(toProject(row), 201)
  })
  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, projectInput)
    const row = await db.transaction(async (tx) => {
      if (!(await ownProject(tx, userId, id))) throw notFound()
      await assertProjectUnique(tx, userId, input, id)
      const [updated] = await tx
        .update(t.projects)
        .set(input)
        .where(eq(t.projects.id, id))
        .returning()
      return updated!
    })
    return c.json(toProject(row))
  })
  .post('/:id/:action{archive|restore}', async (c) => {
    const userId = c.get('userId')
    const archived = c.req.param('action') === 'archive'
    const row = await db.transaction(async (tx) => {
      const [project] = await tx
        .select({ archivedAt: t.projects.archivedAt })
        .from(t.projects)
        .where(
          and(
            eq(t.projects.id, c.req.param('id')),
            eq(t.projects.userId, userId),
          ),
        )
      if (!project) throw notFound()
      if (!archived && project.archivedAt)
        await assertFreeSlot(
          userId,
          () => activeProjects(tx, userId),
          FREE_LIMITS.projects,
          'plan.limit_projects',
        )
      const [updated] = await tx
        .update(t.projects)
        .set({ archivedAt: archived ? new Date() : null })
        .where(
          and(
            eq(t.projects.id, c.req.param('id')),
            eq(t.projects.userId, userId),
          ),
        )
        .returning()
      return updated!
    })
    return c.json(toProject(row))
  })
