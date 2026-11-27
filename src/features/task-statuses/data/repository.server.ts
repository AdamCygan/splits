import type { Tx } from '#/server/db/client'
import { countRows } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { conflict, notFound } from '#/server/http/errors'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'

export const activeStatuses = (tx: Tx, userId: string) =>
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

export const listStatuses = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.taskStatuses)
    .where(eq(t.taskStatuses.userId, userId))
    .orderBy(asc(t.taskStatuses.sortOrder))

export async function ownStatus(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.taskStatuses)
    .where(and(eq(t.taskStatuses.id, id), eq(t.taskStatuses.userId, userId)))
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
        eq(t.taskStatuses.userId, status.userId),
        eq(t.taskStatuses.category, status.category),
        isNull(t.taskStatuses.archivedAt),
        ne(t.taskStatuses.id, status.id),
      ),
    )
  if ((row?.n ?? 0) === 0) throw conflict('status.last_in_category')
}
