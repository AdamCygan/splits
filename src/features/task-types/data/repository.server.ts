import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import type { TaskTypeInput } from '#/features/task-types/data/dto'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName, nameKey } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { currentUser } from '#/features/account/controllers/routes.server'
import { ApiError, conflict, invalid, notFound } from '#/server/http/errors'
import { toTaskType } from './mappers.server'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'

/** Rekord należy do użytkownika? (id spoza konta traktujemy jak nieistniejące). */
export async function ownTaskType(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.taskTypes)
    .where(and(eq(t.taskTypes.id, id), eq(t.taskTypes.userId, userId)))
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

export async function assertTypeSlot(tx: Tx, userId: string) {
  const user = await currentUser(userId)
  if (
    !hasProAccess(user) &&
    (await activeCustomTypes(tx, userId)) >= FREE_LIMITS.customWorkTypes
  )
    throw new ApiError('plan.limit_custom_types', 403)
}

/** Typ bez SP nie ma wartości domyślnej, a typ z wymaganymi SP musi ją mieć. */
export function cleanType(input: TaskTypeInput): TaskTypeInput {
  if (input.storyPointsRequirement === 'hidden')
    return { ...input, defaultStoryPoints: null }
  if (
    input.storyPointsRequirement === 'required' &&
    input.defaultStoryPoints === null
  )
    throw invalid('defaultStoryPoints')
  return { ...input, linkLabel: input.linkLabel || 'Link' }
}

export async function assertUniqueTypeName(
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

/** Rodzaje pracy konta w ustalonej kolejności. */
export async function listTaskTypes(userId: string) {
  const rows = await db
    .select()
    .from(t.taskTypes)
    .where(eq(t.taskTypes.userId, userId))
    .orderBy(asc(t.taskTypes.sortOrder))
  return rows.map(toTaskType)
}

/** Nowy własny rodzaj pracy na końcu listy (unikalna nazwa, limit planu Free). */
export async function createTaskType(userId: string, input: TaskTypeInput) {
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
  return toTaskType(row)
}

export async function updateTaskType(
  userId: string,
  id: string,
  input: TaskTypeInput,
) {
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
  return toTaskType(row)
}

/** Archiwizacja albo przywrócenie; wbudowanych nie archiwizujemy, przywrócenie liczy się do limitu. */
export async function setTaskTypeArchived(
  userId: string,
  id: string,
  archived: boolean,
) {
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
  return toTaskType(row)
}
