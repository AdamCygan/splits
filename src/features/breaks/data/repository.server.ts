import { and, asc, eq } from 'drizzle-orm'

import type { WorkBreak } from '#/features/breaks/data/dto'

import { nowTimeIn, todayIn } from '#/shared/domain/dates'

import { minutesBetween } from '#/features/time-entries/domain/entries'

import { db } from '#/server/db/client'

import type { Tx } from '#/server/db/client'

import * as t from '#/server/db/schema'

import { ApiError, invalid, notFound } from '#/server/http/errors'

import type { dateQuery } from '#/server/http/inputs'

import type { breakEndInput, breakInput } from './inputs.server'

import { toEntry } from '#/features/time-entries/data/mappers.server'

import {
  resumeEntry,
  stopRunning,
  userTimezone,
} from '#/features/time-entries/data/repository.server'

import type { z } from 'zod'

export type Row = typeof t.breaks.$inferSelect

export const toBreak = (row: Row): WorkBreak => ({
  id: row.id,
  workDate: row.workDate,
  startTime: row.startTime,
  endTime: row.endTime,
  durationMinutes: row.durationMinutes,
  running: row.running,
  startedAt: row.startedAt?.toISOString() ?? null,
  resumeEntryId: row.resumeEntryId,
})

export const mine = (userId: string) => eq(t.breaks.userId, userId)

export async function ownBreak(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.breaks)
    .where(and(mine(userId), eq(t.breaks.id, id)))
    .for('update')
  if (!row) throw notFound()
  return row
}

/** Przerwy z dnia (?date=), od najwcześniejszej. */
export async function listBreaks(
  userId: string,
  date: z.infer<typeof dateQuery>['date'],
) {
  const rows = await db
    .select()
    .from(t.breaks)
    .where(and(mine(userId), eq(t.breaks.workDate, date)))
    .orderBy(asc(t.breaks.createdAt))
  return rows.map(toBreak)
}

/** Trwająca przerwa albo null. */
export async function getRunningBreak(userId: string) {
  const [row] = await db
    .select()
    .from(t.breaks)
    .where(and(mine(userId), eq(t.breaks.running, true)))
  return row ? toBreak(row) : null
}

/**
 * Start przerwy: działający timer zadania zostaje wstrzymany (jak „Wstrzymaj”), a przerwa
 * zapamiętuje je, żeby „Koniec przerwy” mogło je od razu wznowić.
 */
export async function startBreak(userId: string) {
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
  return {
    break: toBreak(result.started),
    paused: result.paused ? toEntry(result.paused) : null,
  }
}

/** Koniec przerwy: czas liczony od startu (co najmniej minuta); opcjonalnie wznawia zadanie. */
export async function endBreak(
  userId: string,
  id: string,
  resume: z.infer<typeof breakEndInput>['resume'],
) {
  const result = await db.transaction(async (tx) => {
    const row = await ownBreak(tx, userId, id)
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
  return {
    break: toBreak(result.ended),
    resumed: result.resumed ? toEntry(result.resumed) : null,
  }
}

/** Przerwa dopisana po fakcie (czas trwania albo godziny od–do). */
export async function addBreak(
  userId: string,
  input: z.infer<typeof breakInput>,
) {
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
  return toBreak(row)
}

export async function removeBreak(userId: string, id: string) {
  await db.transaction(async (tx) => {
    const row = await ownBreak(tx, userId, id)
    await tx.delete(t.breaks).where(eq(t.breaks.id, row.id))
  })
  return
}
