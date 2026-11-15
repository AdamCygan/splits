import { and, asc, between, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { addDays, diffDays } from '#/domain/dates'
import type { DayOff, DayOffKind } from '#/data/types'
import { db } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { invalid } from '../http/errors'
import { body, dayOffInput, parse, rangeQuery } from '../http/inputs'

/** Najdłuższy zakres w jednym zapisie (rok urlopu z zapasem). */
const MAX_RANGE_DAYS = 366

const toDayOff = (row: typeof t.daysOff.$inferSelect): DayOff => ({
  date: row.date,
  kind: row.kind as DayOffKind,
  note: row.note,
})

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

export const dayOffRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { from, to } = parse(rangeQuery, c.req.query())
    const rows = await db
      .select()
      .from(t.daysOff)
      .where(
        and(
          eq(t.daysOff.userId, c.get('userId')),
          between(t.daysOff.date, from, to),
        ),
      )
      .orderBy(asc(t.daysOff.date))
    return c.json(rows.map(toDayOff))
  })

  /**
   * Zaznacza zakres jako wolne. Weekendy i inne dni spoza dni pracy z ustawień są pomijane,
   * chyba że zakres to jeden dzień (np. dyżur w sobotę, który odbierasz). Istniejące dni wolne
   * w zakresie dostają nowy rodzaj i notatkę. Zwraca zapisane dni.
   */
  .put('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, dayOffInput)
    if (input.to < input.from) throw invalid('to')
    const length = diffDays(input.from, input.to) + 1
    if (length > MAX_RANGE_DAYS) throw invalid('to')
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
        .values(
          picked.map((date) => ({ userId, date, kind: input.kind, note })),
        )
        .onConflictDoUpdate({
          target: [t.daysOff.userId, t.daysOff.date],
          set: { kind: input.kind, note },
        })
        .returning()
    })
    return c.json(
      rows.sort((a, b) => a.date.localeCompare(b.date)).map(toDayOff),
    )
  })

  /** Usuwa dni wolne z zakresu (?from=&to=), np. cały urlop albo jeden dzień. */
  .delete('/', async (c) => {
    const { from, to } = parse(rangeQuery, c.req.query())
    if (to < from) throw invalid('to')
    await db
      .delete(t.daysOff)
      .where(
        and(
          eq(t.daysOff.userId, c.get('userId')),
          between(t.daysOff.date, from, to),
        ),
      )
    return c.body(null, 204)
  })
