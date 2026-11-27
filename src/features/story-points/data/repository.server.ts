import { asc, eq } from 'drizzle-orm'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { toScaleStep } from './mappers.server'

export interface ScaleStepInput {
  points: number
  maxMinutes: number
}

/** Skala story pointów konta, od najmniejszej wartości. */
export async function getScale(userId: string) {
  const rows = await db
    .select()
    .from(t.storyPointScale)
    .where(eq(t.storyPointScale.userId, userId))
    .orderBy(asc(t.storyPointScale.points))
  return rows.map(toScaleStep)
}

/** Zastępuje całą skalę nowymi krokami (jedna transakcja). */
export async function replaceScale(
  userId: string,
  steps: ReadonlyArray<ScaleStepInput>,
) {
  const rows = await db.transaction(async (tx) => {
    await tx
      .delete(t.storyPointScale)
      .where(eq(t.storyPointScale.userId, userId))
    return tx
      .insert(t.storyPointScale)
      .values(steps.map((s) => ({ ...s, userId })))
      .returning()
  })
  return rows.sort((a, b) => a.points - b.points).map(toScaleStep)
}
