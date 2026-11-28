import type { Tx } from './client'
import type * as schema from './schema'
import { and, eq, sql } from 'drizzle-orm'
import { inScope } from './scope'
import type { Scope } from './scope'

export const nameKey = (column: typeof schema.taskTypes.name) =>
  sql`lower(${column})`

export const lowerName = (value: string) => value.trim().toLowerCase()

export const countRows = async (rows: Promise<Array<{ n: number }>>) =>
  (await rows)[0]?.n ?? 0

export async function reorder(
  transaction: Tx,
  table: typeof schema.taskStatuses | typeof schema.quickTemplates,
  scope: Scope,
  ids: Array<string>,
) {
  for (const [key, id] of ids.entries())
    await transaction
      .update(table)
      .set({ sortOrder: key })
      .where(and(eq(table.id, id), inScope(table, scope)))
}
