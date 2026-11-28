import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import type { TaskStatusInput } from './dto'
import { toStatus } from './mappers.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, lowerName, reorder } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { conflict, notFound } from '#/server/http/errors'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'

export const activeStatuses = (transaction: Tx, scope: Scope) =>
  countRows(
    transaction
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.taskStatuses)
      .where(
        and(
          inScope(schema.taskStatuses, scope),
          isNull(schema.taskStatuses.archivedAt),
        ),
      ),
  )

export const listStatuses = (transaction: Tx, scope: Scope) =>
  transaction
    .select()
    .from(schema.taskStatuses)
    .where(inScope(schema.taskStatuses, scope))
    .orderBy(asc(schema.taskStatuses.sortOrder))

export async function ownStatus(transaction: Tx, scope: Scope, id: string) {
  const [row] = await transaction
    .select()
    .from(schema.taskStatuses)
    .where(
      and(eq(schema.taskStatuses.id, id), inScope(schema.taskStatuses, scope)),
    )
  if (!row) throw notFound()
  return row
}

/** Każda grupa (do zrobienia / w trakcie / gotowe) musi mieć choć jeden aktywny status. */
export async function assertNotLastInCategory(
  transaction: Tx,
  status: typeof schema.taskStatuses.$inferSelect,
) {
  const [row] = await transaction
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.taskStatuses)
    .where(
      and(
        eq(schema.taskStatuses.workspaceId, status.workspaceId),
        eq(schema.taskStatuses.category, status.category),
        isNull(schema.taskStatuses.archivedAt),
        ne(schema.taskStatuses.id, status.id),
      ),
    )
  const isUnused = (row?.n ?? 0) === 0
  if (isUnused) throw conflict('status.last_in_category')
}

const freeStatusSlot = (transaction: Tx, scope: Scope) =>
  assertFreeSlot(
    scope.userId,
    () => activeStatuses(transaction, scope),
    FREE_LIMITS.statuses,
    'plan.limit_statuses',
  )

/** Statusy konta w ustalonej kolejności. */
export async function getStatuses(scope: Scope) {
  return (await listStatuses(database, scope)).map(toStatus)
}

/** Nowy status na końcu listy (unikalna nazwa, limit planu Free). */
export async function createStatus(scope: Scope, input: TaskStatusInput) {
  const row = await database.transaction(async (transaction) => {
    await freeStatusSlot(transaction, scope)
    const all = await listStatuses(transaction, scope)
    const isNameTaken = all.some(
      (existingStatus) =>
        lowerName(existingStatus.name) === lowerName(input.name),
    )
    if (isNameTaken) throw conflict('name_taken', 'name')
    const [created] = await transaction
      .insert(schema.taskStatuses)
      .values({ ...input, ...owner(scope), sortOrder: all.length })
      .returning()
    return created!
  })
  return toStatus(row)
}

/** Nowa kolejność statusów (wszystkie id konta). */
export async function reorderStatuses(scope: Scope, ids: Array<string>) {
  const rows = await database.transaction(async (transaction) => {
    await reorder(transaction, schema.taskStatuses, scope, ids)
    return listStatuses(transaction, scope)
  })
  return rows.map(toStatus)
}

/** Zmiana statusu; w każdej kategorii musi zostać co najmniej jeden aktywny. */
export async function updateStatus(
  scope: Scope,
  id: string,
  input: TaskStatusInput,
) {
  const row = await database.transaction(async (transaction) => {
    const status = await ownStatus(transaction, scope, id)
    const all = await listStatuses(transaction, scope)
    const isNameTaken = all.some(
      (existingStatus) =>
        existingStatus.id !== id &&
        lowerName(existingStatus.name) === lowerName(input.name),
    )
    if (isNameTaken) throw conflict('name_taken', 'name')
    const changesActiveCategory =
      status.category !== input.category && !status.archivedAt
    if (changesActiveCategory)
      await assertNotLastInCategory(transaction, status)
    const [updated] = await transaction
      .update(schema.taskStatuses)
      .set(input)
      .where(eq(schema.taskStatuses.id, id))
      .returning()
    return updated!
  })
  return toStatus(row)
}

/** Status domyślny dla nowych zadań (dokładnie jeden). */
export async function setDefaultStatus(scope: Scope, id: string) {
  const rows = await database.transaction(async (transaction) => {
    const status = await ownStatus(transaction, scope, id)
    if (status.archivedAt) throw notFound()
    await transaction
      .update(schema.taskStatuses)
      .set({ isDefault: false })
      .where(inScope(schema.taskStatuses, scope))
    await transaction
      .update(schema.taskStatuses)
      .set({ isDefault: true })
      .where(eq(schema.taskStatuses.id, id))
    return listStatuses(transaction, scope)
  })
  return rows.map(toStatus)
}

/**
 * Archiwizacja albo przywrócenie. Systemowego ani domyślnego nie archiwizujemy;
 * przywrócenie liczy się do limitu planu Free.
 */
export async function setStatusArchived(
  scope: Scope,
  id: string,
  archived: boolean,
) {
  const row = await database.transaction(async (transaction) => {
    const status = await ownStatus(transaction, scope, id)
    if (archived) {
      if (status.isSystem) throw conflict('status.system_archive')
      if (status.isDefault) throw conflict('status.default_archive')
      await assertNotLastInCategory(transaction, status)
    } else if (status.archivedAt) {
      await freeStatusSlot(transaction, scope)
    }
    const [updated] = await transaction
      .update(schema.taskStatuses)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(schema.taskStatuses.id, id))
      .returning()
    return updated!
  })
  return toStatus(row)
}
