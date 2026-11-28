import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { asc } from 'drizzle-orm'
import { database } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import { toScaleStep } from './mappers.server'

export interface ScaleStepInput {
  points: number
  maxMinutes: number
}

/** Skala story pointów konta, od najmniejszej wartości. */
export async function getScale(scope: Scope) {
  const rows = await database
    .select()
    .from(schema.storyPointScale)
    .where(inScope(schema.storyPointScale, scope))
    .orderBy(asc(schema.storyPointScale.points))
  return rows.map(toScaleStep)
}

/** Zastępuje całą skalę nowymi krokami (jedna transakcja). */
export async function replaceScale(
  scope: Scope,
  steps: ReadonlyArray<ScaleStepInput>,
) {
  const rows = await database.transaction(async (transaction) => {
    await transaction
      .delete(schema.storyPointScale)
      .where(inScope(schema.storyPointScale, scope))
    return transaction
      .insert(schema.storyPointScale)
      .values(
        steps.map((scaleStepInput) => ({ ...scaleStepInput, ...owner(scope) })),
      )
      .returning()
  })
  return rows.sort((left, right) => left.points - right.points).map(toScaleStep)
}
