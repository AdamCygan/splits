import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { asc } from 'drizzle-orm'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { toScaleStep } from './mappers.server'

export interface ScaleStepInput {
  points: number
  maxMinutes: number
}

/** Skala story pointów konta, od najmniejszej wartości. */
export async function getScale(scope: Scope) {
  const rows = await db
    .select()
    .from(t.storyPointScale)
    .where(inScope(t.storyPointScale, scope))
    .orderBy(asc(t.storyPointScale.points))
  return rows.map(toScaleStep)
}

/** Zastępuje całą skalę nowymi krokami (jedna transakcja). */
export async function replaceScale(
  scope: Scope,
  steps: ReadonlyArray<ScaleStepInput>,
) {
  const rows = await db.transaction(async (tx) => {
    await tx.delete(t.storyPointScale).where(inScope(t.storyPointScale, scope))
    return tx
      .insert(t.storyPointScale)
      .values(steps.map((s) => ({ ...s, ...owner(scope) })))
      .returning()
  })
  return rows.sort((a, b) => a.points - b.points).map(toScaleStep)
}
