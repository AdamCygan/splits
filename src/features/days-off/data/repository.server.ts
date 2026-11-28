import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, between, eq } from 'drizzle-orm'
import { database } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import { addDays, weekday } from '#/shared/domain/dates'
import type { DayOff, DayOffInput, DayOffKind } from './dto'

const toDayOff = (row: typeof schema.daysOff.$inferSelect): DayOff => ({
  date: row.date,
  kind: row.kind as DayOffKind,
  note: row.note,
})

const inRange = (scope: Scope, from: string, to: string) =>
  and(inScope(schema.daysOff, scope), between(schema.daysOff.date, from, to))

/** Dni wolne konta w zakresie dat, od najwcześniejszego. */
export async function listDaysOff(scope: Scope, from: string, to: string) {
  const rows = await database
    .select()
    .from(schema.daysOff)
    .where(inRange(scope, from, to))
    .orderBy(asc(schema.daysOff.date))
  return rows.map(toDayOff)
}

/**
 * Zaznacza `length` dni od `input.from` jako wolne. Weekendy i inne dni spoza dni pracy
 * z ustawień są pomijane, chyba że zakres to jeden dzień. Istniejące dni wolne dostają
 * nowy rodzaj i notatkę. Zwraca zapisane dni, od najwcześniejszego.
 */
export async function setDaysOff(
  scope: Scope,
  input: DayOffInput,
  length: number,
) {
  const note = input.note?.trim() || null
  const rows = await database.transaction(async (transaction) => {
    const [settings] = await transaction
      .select({ workingDays: schema.workspaceSettings.workingDays })
      .from(schema.workspaceSettings)
      .where(eq(schema.workspaceSettings.workspaceId, scope.workspaceId))
    const working = settings?.workingDays ?? [1, 2, 3, 4, 5]
    const dates = Array.from({ length }, (_unused, index) =>
      addDays(input.from, index),
    )
    const picked =
      length === 1
        ? dates
        : dates.filter((date) => working.includes(weekday(date)))
    const hasNoDays = picked.length === 0
    if (hasNoDays) return []
    return transaction
      .insert(schema.daysOff)
      .values(
        picked.map((date) => ({
          ...owner(scope),
          date,
          kind: input.kind,
          note,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.daysOff.workspaceId, schema.daysOff.date],
        set: { kind: input.kind, note },
      })
      .returning()
  })
  return rows
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(toDayOff)
}

/** Usuwa dni wolne konta z zakresu (cały urlop albo jeden dzień). */
export async function removeDaysOff(scope: Scope, from: string, to: string) {
  await database.delete(schema.daysOff).where(inRange(scope, from, to))
}
