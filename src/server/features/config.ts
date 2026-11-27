import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { TaskTypeInput } from '#/features/task-types/data/dto'
import { validateScale } from '#/features/story-points/domain/sp-scale'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, conflict, invalid, notFound } from '../http/errors'
import {
  body,
  idsInput,
  projectInput,
  scaleInput,
  settingsInput,
  statusInput,
  tagInput,
  taskTypeInput,
  templateInput,
} from '../http/inputs'
import { currentUser } from './account'
import {
  toProject,
  toScaleStep,
  toSettings,
  toStatus,
  toTag,
  toTaskType,
  toTemplate,
} from './dto'
import { syncCadenceSprints } from './sprints'

const nameKey = (column: typeof t.taskTypes.name) => sql`lower(${column})`
const lowerName = (value: string) => value.trim().toLowerCase()

/** Rekord należy do użytkownika? (id spoza konta traktujemy jak nieistniejące). */
export async function ownTaskType(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.taskTypes)
    .where(and(eq(t.taskTypes.id, id), eq(t.taskTypes.userId, userId)))
  return row
}

export async function ownProject(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.id, id), eq(t.projects.userId, userId)))
  return row
}

async function activeCustomTypes(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(t.taskTypes)
    .where(
      and(
        eq(t.taskTypes.userId, userId),
        eq(t.taskTypes.isSystem, false),
        isNull(t.taskTypes.archivedAt),
      ),
    )
  return row?.n ?? 0
}

async function assertTypeSlot(tx: Tx, userId: string) {
  const user = await currentUser(userId)
  if (
    !hasProAccess(user) &&
    (await activeCustomTypes(tx, userId)) >= FREE_LIMITS.customWorkTypes
  )
    throw new ApiError('plan.limit_custom_types', 403)
}

type FreeLimitCode =
  'plan.limit_projects' | 'plan.limit_templates' | 'plan.limit_statuses'

/**
 * Limit planu Free na liczbę elementów (projekty, szablony, statusy). Liczy się stan przed
 * dodaniem albo przywróceniem z archiwum; Pro i administrator nie mają limitu.
 */
async function assertFreeSlot(
  userId: string,
  count: () => Promise<number>,
  limit: number,
  code: FreeLimitCode,
) {
  const user = await currentUser(userId)
  if (!hasProAccess(user) && (await count()) >= limit)
    throw new ApiError(code, 403)
}

const countRows = async (rows: Promise<Array<{ n: number }>>) =>
  (await rows)[0]?.n ?? 0

const activeProjects = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.projects)
      .where(and(eq(t.projects.userId, userId), isNull(t.projects.archivedAt))),
  )

const activeStatuses = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.taskStatuses)
      .where(
        and(
          eq(t.taskStatuses.userId, userId),
          isNull(t.taskStatuses.archivedAt),
        ),
      ),
  )

const templateCount = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.quickTemplates)
      .where(eq(t.quickTemplates.userId, userId)),
  )

/** Typ bez SP nie ma wartości domyślnej, a typ z wymaganymi SP musi ją mieć. */
function cleanType(input: TaskTypeInput): TaskTypeInput {
  if (input.storyPointsRequirement === 'hidden')
    return { ...input, defaultStoryPoints: null }
  if (
    input.storyPointsRequirement === 'required' &&
    input.defaultStoryPoints === null
  )
    throw invalid('defaultStoryPoints')
  return { ...input, linkLabel: input.linkLabel || 'Link' }
}

async function assertUniqueTypeName(
  tx: Tx,
  userId: string,
  name: string,
  exceptId?: string,
) {
  const [dupe] = await tx
    .select({ id: t.taskTypes.id })
    .from(t.taskTypes)
    .where(
      and(
        eq(t.taskTypes.userId, userId),
        eq(nameKey(t.taskTypes.name), lowerName(name)),
        exceptId ? ne(t.taskTypes.id, exceptId) : undefined,
      ),
    )
  if (dupe) throw conflict('name_taken', 'name')
}

const listStatuses = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.taskStatuses)
    .where(eq(t.taskStatuses.userId, userId))
    .orderBy(asc(t.taskStatuses.sortOrder))

async function ownStatus(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.taskStatuses)
    .where(and(eq(t.taskStatuses.id, id), eq(t.taskStatuses.userId, userId)))
  if (!row) throw notFound()
  return row
}

/** Każda grupa (do zrobienia / w trakcie / gotowe) musi mieć choć jeden aktywny status. */
async function assertNotLastInCategory(
  tx: Tx,
  status: typeof t.taskStatuses.$inferSelect,
) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(t.taskStatuses)
    .where(
      and(
        eq(t.taskStatuses.userId, status.userId),
        eq(t.taskStatuses.category, status.category),
        isNull(t.taskStatuses.archivedAt),
        ne(t.taskStatuses.id, status.id),
      ),
    )
  if ((row?.n ?? 0) === 0) throw conflict('status.last_in_category')
}

async function reorder(
  tx: Tx,
  table: typeof t.taskStatuses | typeof t.quickTemplates,
  userId: string,
  ids: Array<string>,
) {
  for (const [i, id] of ids.entries())
    await tx
      .update(table)
      .set({ sortOrder: i })
      .where(and(eq(table.id, id), eq(table.userId, userId)))
}

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const [row] = await db
      .select()
      .from(t.userSettings)
      .where(eq(t.userSettings.userId, c.get('userId')))
    if (!row) throw notFound()
    return c.json(toSettings(row))
  })
  .put('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, settingsInput)
    const row = await db.transaction(async (tx) => {
      // Przypomnienia e-mail są w Pro. Free może je tylko wyłączyć albo zostawić bez zmian.
      if (input.dailyReminderAt !== null) {
        const [current] = await tx
          .select({ at: t.userSettings.dailyReminderAt })
          .from(t.userSettings)
          .where(eq(t.userSettings.userId, userId))
        if (
          current?.at !== input.dailyReminderAt &&
          !hasProAccess(await currentUser(userId))
        )
          throw new ApiError('plan.pro_feature', 403, 'dailyReminderAt')
      }
      const [updated] = await tx
        .update(t.userSettings)
        .set({
          ...input,
          workingDays: [...new Set(input.workingDays)].sort((a, b) => a - b),
          summaryTemplate: input.summaryTemplate?.trim()
            ? input.summaryTemplate
            : null,
        })
        .where(eq(t.userSettings.userId, userId))
        .returning()
      await syncCadenceSprints(tx, userId)
      return updated
    })
    if (!row) throw notFound()
    return c.json(toSettings(row))
  })

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

interface ProjectIdentity {
  name: string
  key: string | null
}

async function assertProjectUnique(
  tx: Tx,
  userId: string,
  input: ProjectIdentity,
  exceptId?: string,
) {
  const others = await tx
    .select()
    .from(t.projects)
    .where(
      and(
        eq(t.projects.userId, userId),
        exceptId ? ne(t.projects.id, exceptId) : undefined,
      ),
    )
  if (others.some((p) => lowerName(p.name) === lowerName(input.name)))
    throw conflict('name_taken', 'name')
  if (input.key && others.some((p) => p.key === input.key))
    throw conflict('key_taken', 'key')
}

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

const listTemplates = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.quickTemplates)
    .where(eq(t.quickTemplates.userId, userId))
    .orderBy(asc(t.quickTemplates.sortOrder))

interface TemplateRefs {
  taskTypeId: string
  projectId: string | null
  hotkey: number | null
}

async function checkTemplate(
  tx: Tx,
  userId: string,
  input: TemplateRefs,
  exceptId?: string,
) {
  if (!(await ownTaskType(tx, userId, input.taskTypeId)))
    throw new ApiError('type.unknown', 400, 'taskTypeId')
  if (input.projectId && !(await ownProject(tx, userId, input.projectId)))
    throw invalid('projectId')
  if (input.hotkey !== null) {
    const all = await listTemplates(tx, userId)
    if (all.some((x) => x.id !== exceptId && x.hotkey === input.hotkey))
      throw conflict('hotkey_taken', 'hotkey')
  }
}

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
