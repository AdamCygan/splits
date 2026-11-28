import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import type { TaskStatusInput } from './dto'
import { toStatus } from './mappers.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, lowerName, reorder } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { conflict, notFound } from '#/server/http/errors'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'

export const activeStatuses = (tx: Tx, scope: Scope) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.taskStatuses)
      .where(
        and(inScope(t.taskStatuses, scope), isNull(t.taskStatuses.archivedAt)),
      ),
  )

export const listStatuses = (tx: Tx, scope: Scope) =>
  tx
    .select()
    .from(t.taskStatuses)
    .where(inScope(t.taskStatuses, scope))
    .orderBy(asc(t.taskStatuses.sortOrder))

export async function ownStatus(tx: Tx, scope: Scope, id: string) {
  const [row] = await tx
    .select()
    .from(t.taskStatuses)
    .where(and(eq(t.taskStatuses.id, id), inScope(t.taskStatuses, scope)))
  if (!row) throw notFound()
  return row
}

/** Każda grupa (do zrobienia / w trakcie / gotowe) musi mieć choć jeden aktywny status. */
export async function assertNotLastInCategory(
  tx: Tx,
  status: typeof t.taskStatuses.$inferSelect,
) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(t.taskStatuses)
    .where(
      and(
        eq(t.taskStatuses.workspaceId, status.workspaceId),
        eq(t.taskStatuses.category, status.category),
        isNull(t.taskStatuses.archivedAt),
        ne(t.taskStatuses.id, status.id),
      ),
    )
  if ((row?.n ?? 0) === 0) throw conflict('status.last_in_category')
}

const freeStatusSlot = (tx: Tx, scope: Scope) =>
  assertFreeSlot(
    scope.userId,
    () => activeStatuses(tx, scope),
    FREE_LIMITS.statuses,
    'plan.limit_statuses',
  )

/** Statusy konta w ustalonej kolejności. */
export async function getStatuses(scope: Scope) {
  return (await listStatuses(db, scope)).map(toStatus)
}

/** Nowy status na końcu listy (unikalna nazwa, limit planu Free). */
export async function createStatus(scope: Scope, input: TaskStatusInput) {
  const row = await db.transaction(async (tx) => {
    await freeStatusSlot(tx, scope)
    const all = await listStatuses(tx, scope)
    if (all.some((s) => lowerName(s.name) === lowerName(input.name)))
      throw conflict('name_taken', 'name')
    const [created] = await tx
      .insert(t.taskStatuses)
      .values({ ...input, ...owner(scope), sortOrder: all.length })
      .returning()
    return created!
  })
  return toStatus(row)
}

/** Nowa kolejność statusów (wszystkie id konta). */
export async function reorderStatuses(scope: Scope, ids: Array<string>) {
  const rows = await db.transaction(async (tx) => {
    await reorder(tx, t.taskStatuses, scope, ids)
    return listStatuses(tx, scope)
  })
  return rows.map(toStatus)
}

/** Zmiana statusu; w każdej kategorii musi zostać co najmniej jeden aktywny. */
export async function updateStatus(
  scope: Scope,
  id: string,
  input: TaskStatusInput,
) {
  const row = await db.transaction(async (tx) => {
    const status = await ownStatus(tx, scope, id)
    const all = await listStatuses(tx, scope)
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
  return toStatus(row)
}

/** Status domyślny dla nowych zadań (dokładnie jeden). */
export async function setDefaultStatus(scope: Scope, id: string) {
  const rows = await db.transaction(async (tx) => {
    const status = await ownStatus(tx, scope, id)
    if (status.archivedAt) throw notFound()
    await tx
      .update(t.taskStatuses)
      .set({ isDefault: false })
      .where(inScope(t.taskStatuses, scope))
    await tx
      .update(t.taskStatuses)
      .set({ isDefault: true })
      .where(eq(t.taskStatuses.id, id))
    return listStatuses(tx, scope)
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
  const row = await db.transaction(async (tx) => {
    const status = await ownStatus(tx, scope, id)
    if (archived) {
      if (status.isSystem) throw conflict('status.system_archive')
      if (status.isDefault) throw conflict('status.default_archive')
      await assertNotLastInCategory(tx, status)
    } else if (status.archivedAt) {
      await freeStatusSlot(tx, scope)
    }
    const [updated] = await tx
      .update(t.taskStatuses)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(t.taskStatuses.id, id))
      .returning()
    return updated!
  })
  return toStatus(row)
}
