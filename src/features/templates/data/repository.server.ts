import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { ownProject } from '#/features/projects/data/repository.server'
import { ownTaskType } from '#/features/task-types/data/repository.server'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, reorder } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { ApiError, conflict, invalid, notFound } from '#/server/http/errors'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { templateInput } from './inputs.server'
import { toTemplate } from './mappers.server'

export const templateCount = (tx: Tx, scope: Scope) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.quickTemplates)
      .where(inScope(t.quickTemplates, scope)),
  )

export const listTemplates = (tx: Tx, scope: Scope) =>
  tx
    .select()
    .from(t.quickTemplates)
    .where(inScope(t.quickTemplates, scope))
    .orderBy(asc(t.quickTemplates.sortOrder))

interface TemplateRefs {
  taskTypeId: string
  projectId: string | null
  hotkey: number | null
}

export async function checkTemplate(
  tx: Tx,
  scope: Scope,
  input: TemplateRefs,
  exceptId?: string,
) {
  if (!(await ownTaskType(tx, scope, input.taskTypeId)))
    throw new ApiError('type.unknown', 400, 'taskTypeId')
  if (input.projectId && !(await ownProject(tx, scope, input.projectId)))
    throw invalid('projectId')
  if (input.hotkey !== null) {
    const all = await listTemplates(tx, scope)
    if (all.some((x) => x.id !== exceptId && x.hotkey === input.hotkey))
      throw conflict('hotkey_taken', 'hotkey')
  }
}

export type TemplateInput = z.infer<typeof templateInput>

const ownTemplate = (scope: Scope, id: string) =>
  and(eq(t.quickTemplates.id, id), inScope(t.quickTemplates, scope))

/** Szybkie szablony konta w ustalonej kolejności. */
export async function getTemplates(scope: Scope) {
  return (await listTemplates(db, scope)).map(toTemplate)
}

/** Nowy szablon na końcu listy (własny rodzaj pracy i projekt, wolny skrót, limit Free). */
export async function createTemplate(scope: Scope, input: TemplateInput) {
  const row = await db.transaction(async (tx) => {
    await assertFreeSlot(
      scope.userId,
      () => templateCount(tx, scope),
      FREE_LIMITS.quickTemplates,
      'plan.limit_templates',
    )
    await checkTemplate(tx, scope, input)
    const all = await listTemplates(tx, scope)
    const [created] = await tx
      .insert(t.quickTemplates)
      .values({ ...input, ...owner(scope), sortOrder: all.length })
      .returning()
    return created!
  })
  return toTemplate(row)
}

/** Nowa kolejność szablonów (wszystkie id konta). */
export async function reorderTemplates(scope: Scope, ids: Array<string>) {
  const rows = await db.transaction(async (tx) => {
    await reorder(tx, t.quickTemplates, scope, ids)
    return listTemplates(tx, scope)
  })
  return rows.map(toTemplate)
}

export async function updateTemplate(
  scope: Scope,
  id: string,
  input: TemplateInput,
) {
  const row = await db.transaction(async (tx) => {
    await checkTemplate(tx, scope, input, id)
    const [updated] = await tx
      .update(t.quickTemplates)
      .set(input)
      .where(ownTemplate(scope, id))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toTemplate(row)
}

export async function removeTemplate(scope: Scope, id: string) {
  await db.delete(t.quickTemplates).where(ownTemplate(scope, id))
}
