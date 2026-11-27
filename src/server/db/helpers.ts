import type { Tx } from './client'
import type * as t from './schema'
import { and, eq, sql } from 'drizzle-orm'

export const nameKey = (column: typeof t.taskTypes.name) =>
  sql`lower(${column})`

export const lowerName = (value: string) => value.trim().toLowerCase()

export const countRows = async (rows: Promise<Array<{ n: number }>>) =>
  (await rows)[0]?.n ?? 0

export async function reorder(
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
