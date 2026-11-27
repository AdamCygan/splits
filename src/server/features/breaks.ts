import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { WorkBreak } from '#/features/breaks/data/dto'
import { nowTimeIn, todayIn } from '#/domain/dates'
import { minutesBetween } from '#/domain/entries'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, invalid, notFound } from '../http/errors'
import {
  body,
  breakEndInput,
  breakInput,
  dateQuery,
  parse,
} from '../http/inputs'
import { toEntry } from './dto'
import { resumeEntry, stopRunning, userTimezone } from './entries'

type Row = typeof t.breaks.$inferSelect

const toBreak = (row: Row): WorkBreak => ({
  id: row.id,
  workDate: row.workDate,
  startTime: row.startTime,
  endTime: row.endTime,
  durationMinutes: row.durationMinutes,
  running: row.running,
  startedAt: row.startedAt?.toISOString() ?? null,
  resumeEntryId: row.resumeEntryId,
})

const mine = (userId: string) => eq(t.breaks.userId, userId)

async function ownBreak(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.breaks)
    .where(and(mine(userId), eq(t.breaks.id, id)))
    .for('update')
  if (!row) throw notFound()
  return row
}

export const breakRoutes = new Hono<AppEnv>()
  /** Przerwy z dnia (?date=), od najwcześniejszej. */
  .get('/', async (c) => {
    const { date } = parse(dateQuery, c.req.query())
    const rows = await db
      .select()
      .from(t.breaks)
      .where(and(mine(c.get('userId')), eq(t.breaks.workDate, date)))
      .orderBy(asc(t.breaks.createdAt))
    return c.json(rows.map(toBreak))
  })

  /** Trwająca przerwa albo null. */
  .get('/running', async (c) => {
    const [row] = await db
      .select()
      .from(t.breaks)
      .where(and(mine(c.get('userId')), eq(t.breaks.running, true)))
    return c.json(row ? toBreak(row) : null)
  })

  /**
   * Start przerwy: działający timer zadania zostaje wstrzymany (jak „Wstrzymaj”), a przerwa
   * zapamiętuje je, żeby „Koniec przerwy” mogło je od razu wznowić.
   */
  .post('/start', async (c) => {
    const userId = c.get('userId')
    const result = await db.transaction(async (tx) => {
      const [running] = await tx
        .select()
        .from(t.breaks)
        .where(and(mine(userId), eq(t.breaks.running, true)))
        .for('update')
      if (running) throw new ApiError('break.running', 409)
      const timezone = await userTimezone(tx, userId)
      const paused = await stopRunning(tx, userId, timezone)
      const [started] = await tx
        .insert(t.breaks)
        .values({
          userId,
          workDate: todayIn(timezone),
          startTime: nowTimeIn(timezone),
          running: true,
          startedAt: new Date(),
          resumeEntryId: paused?.id ?? null,
        })
        .returning()
      return { started: started!, paused }
    })
    return c.json(
      {
        break: toBreak(result.started),
        paused: result.paused ? toEntry(result.paused) : null,
      },
      201,
    )
  })

  /** Koniec przerwy: czas liczony od startu (co najmniej minuta); opcjonalnie wznawia zadanie. */
  .post('/:id/end', async (c) => {
    const userId = c.get('userId')
    const { resume } = await body(c, breakEndInput)
    const result = await db.transaction(async (tx) => {
      const row = await ownBreak(tx, userId, c.req.param('id'))
      if (!row.running) return { ended: row, resumed: null }
      const timezone = await userTimezone(tx, userId)
      const minutes = Math.min(
        1440,
        Math.max(
          1,
          Math.round(
            (Date.now() - (row.startedAt?.getTime() ?? Date.now())) / 60_000,
          ),
        ),
      )
      const sameDay = row.workDate === todayIn(timezone)
      const [ended] = await tx
        .update(t.breaks)
        .set({
          running: false,
          durationMinutes: minutes,
          // Przerwa przez północ: zostaje sam czas trwania w dniu startu.
          startTime: sameDay ? row.startTime : null,
          endTime: sameDay ? nowTimeIn(timezone) : null,
        })
        .where(eq(t.breaks.id, row.id))
        .returning()
      const resumed =
        resume && row.resumeEntryId
          ? (await resumeEntry(tx, userId, row.resumeEntryId)).started
          : null
      return { ended: ended!, resumed }
    })
    return c.json({
      break: toBreak(result.ended),
      resumed: result.resumed ? toEntry(result.resumed) : null,
    })
  })

  /** Przerwa dopisana po fakcie (czas trwania albo godziny od–do). */
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, breakInput)
    const row = await db.transaction(async (tx) => {
      const timezone = await userTimezone(tx, userId)
      if (input.workDate > todayIn(timezone)) throw invalid('workDate')
      let minutes = input.durationMinutes
      if (input.startTime || input.endTime) {
        const between =
          input.startTime && input.endTime
            ? minutesBetween(input.startTime, input.endTime)
            : null
        if (between === null || between < 1) throw invalid('endTime')
        minutes = between
      }
      const [created] = await tx
        .insert(t.breaks)
        .values({
          userId,
          workDate: input.workDate,
          startTime: input.startTime,
          endTime: input.endTime,
          durationMinutes: minutes,
        })
        .returning()
      return created!
    })
    return c.json(toBreak(row), 201)
  })

  .delete('/:id', async (c) => {
    const userId = c.get('userId')
    await db.transaction(async (tx) => {
      const row = await ownBreak(tx, userId, c.req.param('id'))
      await tx.delete(t.breaks).where(eq(t.breaks.id, row.id))
    })
    return c.body(null, 204)
  })
