import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, between, eq } from 'drizzle-orm'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { addDays, weekday } from '#/shared/domain/dates'
import type { DayOff, DayOffInput, DayOffKind } from './dto'

const toDayOff = (row: typeof t.daysOff.$inferSelect): DayOff => ({
  date: row.date,
  kind: row.kind as DayOffKind,
  note: row.note,
})

const inRange = (scope: Scope, from: string, to: string) =>
  and(inScope(t.daysOff, scope), between(t.daysOff.date, from, to))

/** Dni wolne konta w zakresie dat, od najwcześniejszego. */
export async function listDaysOff(scope: Scope, from: string, to: string) {
  const rows = await db
    .select()
    .from(t.daysOff)
    .where(inRange(scope, from, to))
    .orderBy(asc(t.daysOff.date))
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
  const rows = await db.transaction(async (tx) => {
    const [settings] = await tx
      .select({ workingDays: t.workspaceSettings.workingDays })
      .from(t.workspaceSettings)
      .where(eq(t.workspaceSettings.workspaceId, scope.workspaceId))
    const working = settings?.workingDays ?? [1, 2, 3, 4, 5]
    const dates = Array.from({ length }, (_, i) => addDays(input.from, i))
    const picked =
      length === 1 ? dates : dates.filter((d) => working.includes(weekday(d)))
    if (picked.length === 0) return []
    return tx
      .insert(t.daysOff)
      .values(
        picked.map((date) => ({
          ...owner(scope),
          date,
          kind: input.kind,
          note,
        })),
      )
      .onConflictDoUpdate({
        target: [t.daysOff.workspaceId, t.daysOff.date],
        set: { kind: input.kind, note },
      })
      .returning()
  })
  return rows.sort((a, b) => a.date.localeCompare(b.date)).map(toDayOff)
}

/** Usuwa dni wolne konta z zakresu (cały urlop albo jeden dzień). */
export async function removeDaysOff(scope: Scope, from: string, to: string) {
  await db.delete(t.daysOff).where(inRange(scope, from, to))
}
