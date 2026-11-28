import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import type { TaskTypeInput } from '#/features/task-types/data/dto'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName, nameKey } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { currentUser } from '#/features/account/data/repository.server'
import { ApiError, conflict, invalid, notFound } from '#/server/http/errors'
import { toTaskType } from './mappers.server'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'

/** Rekord należy do użytkownika? (id spoza konta traktujemy jak nieistniejące). */
export async function ownTaskType(transaction: Tx, scope: Scope, id: string) {
  const [row] = await transaction
    .select()
    .from(schema.taskTypes)
    .where(and(eq(schema.taskTypes.id, id), inScope(schema.taskTypes, scope)))
  return row
}

async function activeCustomTypes(transaction: Tx, scope: Scope) {
  const [row] = await transaction
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.taskTypes)
    .where(
      and(
        inScope(schema.taskTypes, scope),
        eq(schema.taskTypes.isSystem, false),
        isNull(schema.taskTypes.archivedAt),
      ),
    )
  return row?.n ?? 0
}

export async function assertTypeSlot(transaction: Tx, scope: Scope) {
  const user = await currentUser(scope.userId)
  if (
    !hasProAccess(user) &&
    (await activeCustomTypes(transaction, scope)) >= FREE_LIMITS.customWorkTypes
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
  transaction: Tx,
  scope: Scope,
  name: string,
  exceptId?: string,
) {
  const [dupe] = await transaction
    .select({ id: schema.taskTypes.id })
    .from(schema.taskTypes)
    .where(
      and(
        inScope(schema.taskTypes, scope),
        eq(nameKey(schema.taskTypes.name), lowerName(name)),
        exceptId ? ne(schema.taskTypes.id, exceptId) : undefined,
      ),
    )
  if (dupe) throw conflict('name_taken', 'name')
}

/** Rodzaje pracy konta w ustalonej kolejności. */
export async function listTaskTypes(scope: Scope) {
  const rows = await database
    .select()
    .from(schema.taskTypes)
    .where(inScope(schema.taskTypes, scope))
    .orderBy(asc(schema.taskTypes.sortOrder))
  return rows.map(toTaskType)
}

/** Nowy własny rodzaj pracy na końcu listy (unikalna nazwa, limit planu Free). */
export async function createTaskType(scope: Scope, input: TaskTypeInput) {
  const row = await database.transaction(async (transaction) => {
    await assertUniqueTypeName(transaction, scope, input.name)
    await assertTypeSlot(transaction, scope)
    const [{ n: count } = { n: 0 }] = await transaction
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.taskTypes)
      .where(inScope(schema.taskTypes, scope))
    const [created] = await transaction
      .insert(schema.taskTypes)
      .values({
        ...input,
        ...owner(scope),
        kind: 'custom',
        isSystem: false,
        sortOrder: count,
      })
      .returning()
    return created!
  })
  return toTaskType(row)
}

export async function updateTaskType(
  scope: Scope,
  id: string,
  input: TaskTypeInput,
) {
  const row = await database.transaction(async (transaction) => {
    if (!(await ownTaskType(transaction, scope, id))) throw notFound()
    await assertUniqueTypeName(transaction, scope, input.name, id)
    const [updated] = await transaction
      .update(schema.taskTypes)
      .set(input)
      .where(eq(schema.taskTypes.id, id))
      .returning()
    return updated!
  })
  return toTaskType(row)
}

/** Archiwizacja albo przywrócenie; wbudowanych nie archiwizujemy, przywrócenie liczy się do limitu. */
export async function setTaskTypeArchived(
  scope: Scope,
  id: string,
  archived: boolean,
) {
  const row = await database.transaction(async (transaction) => {
    const type = await ownTaskType(transaction, scope, id)
    if (!type) throw notFound()
    if (type.isSystem && archived) throw conflict('type.system_archive')
    if (!archived && !type.isSystem && type.archivedAt)
      await assertTypeSlot(transaction, scope)
    const [updated] = await transaction
      .update(schema.taskTypes)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(schema.taskTypes.id, id))
      .returning()
    return updated!
  })
  return toTaskType(row)
}
