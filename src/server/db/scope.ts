import { and, eq } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Zakres danych żądania: konto i bieżąca przestrzeń. Przestrzeń jest sprawdzona w middleware
 * (należy do konta), a zapytania i tak filtrują po obu kolumnach.
 */
export interface Scope {
  readonly userId: string
  readonly workspaceId: string
}

interface Scoped {
  userId: AnyPgColumn
  workspaceId: AnyPgColumn
}

/** Warunek: wiersz należy do konta i do bieżącej przestrzeni. */
export const inScope = (table: Scoped, scope: Scope) =>
  and(eq(table.userId, scope.userId), eq(table.workspaceId, scope.workspaceId))!

/** Kolumny właściciela dla nowego wiersza. */
export const owner = (scope: Scope) => ({
  userId: scope.userId,
  workspaceId: scope.workspaceId,
})
