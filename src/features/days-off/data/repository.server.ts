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

const inRange = (userId: string, from: string, to: string) =>
  and(eq(t.daysOff.userId, userId), between(t.daysOff.date, from, to))

/** Dni wolne konta w zakresie dat, od najwcześniejszego. */
export async function listDaysOff(userId: string, from: string, to: string) {
  const rows = await db
    .select()
    .from(t.daysOff)
    .where(inRange(userId, from, to))
    .orderBy(asc(t.daysOff.date))
  return rows.map(toDayOff)
}

/**
 * Zaznacza `length` dni od `input.from` jako wolne. Weekendy i inne dni spoza dni pracy
 * z ustawień są pomijane, chyba że zakres to jeden dzień. Istniejące dni wolne dostają
 * nowy rodzaj i notatkę. Zwraca zapisane dni, od najwcześniejszego.
 */
export async function setDaysOff(
  userId: string,
  input: DayOffInput,
  length: number,
) {
  const note = input.note?.trim() || null
  const rows = await db.transaction(async (tx) => {
    const [settings] = await tx
      .select({ workingDays: t.userSettings.workingDays })
      .from(t.userSettings)
      .where(eq(t.userSettings.userId, userId))
    const working = settings?.workingDays ?? [1, 2, 3, 4, 5]
    const dates = Array.from({ length }, (_, i) => addDays(input.from, i))
    const picked =
      length === 1 ? dates : dates.filter((d) => working.includes(weekday(d)))
    if (picked.length === 0) return []
    return tx
      .insert(t.daysOff)
      .values(picked.map((date) => ({ userId, date, kind: input.kind, note })))
      .onConflictDoUpdate({
        target: [t.daysOff.userId, t.daysOff.date],
        set: { kind: input.kind, note },
      })
      .returning()
  })
  return rows.sort((a, b) => a.date.localeCompare(b.date)).map(toDayOff)
}

/** Usuwa dni wolne konta z zakresu (cały urlop albo jeden dzień). */
export async function removeDaysOff(userId: string, from: string, to: string) {
  await db.delete(t.daysOff).where(inRange(userId, from, to))
}
