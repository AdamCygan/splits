import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq } from 'drizzle-orm'

import type { WorkBreak } from '#/features/breaks/data/dto'

import { nowTimeIn, todayIn } from '#/shared/domain/dates'

import { minutesBetween } from '#/features/time-entries/domain/entries'

import { database } from '#/server/db/client'

import type { Tx } from '#/server/db/client'

import * as schema from '#/server/db/schema'

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

export type Row = typeof schema.breaks.$inferSelect

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

export const mine = (scope: Scope) => inScope(schema.breaks, scope)

export async function ownBreak(transaction: Tx, scope: Scope, id: string) {
  const [row] = await transaction
    .select()
    .from(schema.breaks)
    .where(and(mine(scope), eq(schema.breaks.id, id)))
    .for('update')
  if (!row) throw notFound()
  return row
}

/** Przerwy z dnia (?date=), od najwcześniejszej. */
export async function listBreaks(
  scope: Scope,
  date: z.infer<typeof dateQuery>['date'],
) {
  const rows = await database
    .select()
    .from(schema.breaks)
    .where(and(mine(scope), eq(schema.breaks.workDate, date)))
    .orderBy(asc(schema.breaks.createdAt))
  return rows.map(toBreak)
}

/** Trwająca przerwa albo null. */
export async function getRunningBreak(scope: Scope) {
  const [row] = await database
    .select()
    .from(schema.breaks)
    .where(and(mine(scope), eq(schema.breaks.running, true)))
  return row ? toBreak(row) : null
}

/**
 * Start przerwy: działający timer zadania zostaje wstrzymany (jak „Wstrzymaj”), a przerwa
 * zapamiętuje je, żeby „Koniec przerwy” mogło je od razu wznowić.
 */
export async function startBreak(scope: Scope) {
  const result = await database.transaction(async (transaction) => {
    const [running] = await transaction
      .select()
      .from(schema.breaks)
      // Jedna trwająca przerwa na konto, niezależnie od przestrzeni.
      .where(
        and(
          eq(schema.breaks.userId, scope.userId),
          eq(schema.breaks.running, true),
        ),
      )
      .for('update')
    if (running) throw new ApiError('break.running', 409)
    const timezone = await userTimezone(transaction, scope)
    const paused = await stopRunning(transaction, scope, timezone)
    const [started] = await transaction
      .insert(schema.breaks)
      .values({
        ...owner(scope),
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
  scope: Scope,
  id: string,
  resume: z.infer<typeof breakEndInput>['resume'],
) {
  const result = await database.transaction(async (transaction) => {
    const row = await ownBreak(transaction, scope, id)
    if (!row.running) return { ended: row, resumed: null }
    const timezone = await userTimezone(transaction, scope)
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
    const [ended] = await transaction
      .update(schema.breaks)
      .set({
        running: false,
        durationMinutes: minutes,
        // Przerwa przez północ: zostaje sam czas trwania w dniu startu.
        startTime: sameDay ? row.startTime : null,
        endTime: sameDay ? nowTimeIn(timezone) : null,
      })
      .where(eq(schema.breaks.id, row.id))
      .returning()
    const resumed =
      resume && row.resumeEntryId
        ? (await resumeEntry(transaction, scope, row.resumeEntryId)).started
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
  scope: Scope,
  input: z.infer<typeof breakInput>,
) {
  const row = await database.transaction(async (transaction) => {
    const timezone = await userTimezone(transaction, scope)
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
    const [created] = await transaction
      .insert(schema.breaks)
      .values({
        ...owner(scope),
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

export async function removeBreak(scope: Scope, id: string) {
  await database.transaction(async (transaction) => {
    const row = await ownBreak(transaction, scope, id)
    await transaction.delete(schema.breaks).where(eq(schema.breaks.id, row.id))
  })
  return
}
