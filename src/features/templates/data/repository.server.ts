import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { ownProject } from '#/features/projects/data/repository.server'
import { ownTaskType } from '#/features/task-types/data/repository.server'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, reorder } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { ApiError, conflict, invalid, notFound } from '#/server/http/errors'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { templateInput } from './inputs.server'
import { toTemplate } from './mappers.server'

export const templateCount = (transaction: Tx, scope: Scope) =>
  countRows(
    transaction
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.quickTemplates)
      .where(inScope(schema.quickTemplates, scope)),
  )

export const listTemplates = (transaction: Tx, scope: Scope) =>
  transaction
    .select()
    .from(schema.quickTemplates)
    .where(inScope(schema.quickTemplates, scope))
    .orderBy(asc(schema.quickTemplates.sortOrder))

interface TemplateRefs {
  taskTypeId: string
  projectId: string | null
  hotkey: number | null
}

export async function checkTemplate(
  transaction: Tx,
  scope: Scope,
  input: TemplateRefs,
  exceptId?: string,
) {
  if (!(await ownTaskType(transaction, scope, input.taskTypeId)))
    throw new ApiError('type.unknown', 400, 'taskTypeId')
  if (
    input.projectId &&
    !(await ownProject(transaction, scope, input.projectId))
  )
    throw invalid('projectId')
  if (input.hotkey !== null) {
    const all = await listTemplates(transaction, scope)
    if (
      all.some(
        (otherTemplate) =>
          otherTemplate.id !== exceptId &&
          otherTemplate.hotkey === input.hotkey,
      )
    )
      throw conflict('hotkey_taken', 'hotkey')
  }
}

export type TemplateInput = z.infer<typeof templateInput>

const ownTemplate = (scope: Scope, id: string) =>
  and(eq(schema.quickTemplates.id, id), inScope(schema.quickTemplates, scope))

/** Szybkie szablony konta w ustalonej kolejności. */
export async function getTemplates(scope: Scope) {
  return (await listTemplates(database, scope)).map(toTemplate)
}

/** Nowy szablon na końcu listy (własny rodzaj pracy i projekt, wolny skrót, limit Free). */
export async function createTemplate(scope: Scope, input: TemplateInput) {
  const row = await database.transaction(async (transaction) => {
    await assertFreeSlot(
      scope.userId,
      () => templateCount(transaction, scope),
      FREE_LIMITS.quickTemplates,
      'plan.limit_templates',
    )
    await checkTemplate(transaction, scope, input)
    const all = await listTemplates(transaction, scope)
    const [created] = await transaction
      .insert(schema.quickTemplates)
      .values({ ...input, ...owner(scope), sortOrder: all.length })
      .returning()
    return created!
  })
  return toTemplate(row)
}

/** Nowa kolejność szablonów (wszystkie id konta). */
export async function reorderTemplates(scope: Scope, ids: Array<string>) {
  const rows = await database.transaction(async (transaction) => {
    await reorder(transaction, schema.quickTemplates, scope, ids)
    return listTemplates(transaction, scope)
  })
  return rows.map(toTemplate)
}

export async function updateTemplate(
  scope: Scope,
  id: string,
  input: TemplateInput,
) {
  const row = await database.transaction(async (transaction) => {
    await checkTemplate(transaction, scope, input, id)
    const [updated] = await transaction
      .update(schema.quickTemplates)
      .set(input)
      .where(ownTemplate(scope, id))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toTemplate(row)
}

export async function removeTemplate(scope: Scope, id: string) {
  await database.delete(schema.quickTemplates).where(ownTemplate(scope, id))
}
