import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import type { TaskTypeInput } from '#/features/task-types/data/dto'
import type { Tx } from '#/server/db/client'
import { lowerName, nameKey } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { currentUser } from '#/features/account/controllers/routes.server'
import { ApiError, conflict, invalid } from '#/server/http/errors'
import { and, eq, isNull, ne, sql } from 'drizzle-orm'

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
