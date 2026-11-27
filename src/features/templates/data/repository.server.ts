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

export const templateCount = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.quickTemplates)
      .where(eq(t.quickTemplates.userId, userId)),
  )

export const listTemplates = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.quickTemplates)
    .where(eq(t.quickTemplates.userId, userId))
    .orderBy(asc(t.quickTemplates.sortOrder))

interface TemplateRefs {
  taskTypeId: string
  projectId: string | null
  hotkey: number | null
}

export async function checkTemplate(
  tx: Tx,
  userId: string,
  input: TemplateRefs,
  exceptId?: string,
) {
  if (!(await ownTaskType(tx, userId, input.taskTypeId)))
    throw new ApiError('type.unknown', 400, 'taskTypeId')
  if (input.projectId && !(await ownProject(tx, userId, input.projectId)))
    throw invalid('projectId')
  if (input.hotkey !== null) {
    const all = await listTemplates(tx, userId)
    if (all.some((x) => x.id !== exceptId && x.hotkey === input.hotkey))
      throw conflict('hotkey_taken', 'hotkey')
  }
}

export type TemplateInput = z.infer<typeof templateInput>

const ownTemplate = (userId: string, id: string) =>
  and(eq(t.quickTemplates.id, id), eq(t.quickTemplates.userId, userId))

/** Szybkie szablony konta w ustalonej kolejności. */
export async function getTemplates(userId: string) {
  return (await listTemplates(db, userId)).map(toTemplate)
}

/** Nowy szablon na końcu listy (własny rodzaj pracy i projekt, wolny skrót, limit Free). */
export async function createTemplate(userId: string, input: TemplateInput) {
  const row = await db.transaction(async (tx) => {
    await assertFreeSlot(
      userId,
      () => templateCount(tx, userId),
      FREE_LIMITS.quickTemplates,
      'plan.limit_templates',
    )
    await checkTemplate(tx, userId, input)
    const all = await listTemplates(tx, userId)
    const [created] = await tx
      .insert(t.quickTemplates)
      .values({ ...input, userId, sortOrder: all.length })
      .returning()
    return created!
  })
  return toTemplate(row)
}

/** Nowa kolejność szablonów (wszystkie id konta). */
export async function reorderTemplates(userId: string, ids: Array<string>) {
  const rows = await db.transaction(async (tx) => {
    await reorder(tx, t.quickTemplates, userId, ids)
    return listTemplates(tx, userId)
  })
  return rows.map(toTemplate)
}

export async function updateTemplate(
  userId: string,
  id: string,
  input: TemplateInput,
) {
  const row = await db.transaction(async (tx) => {
    await checkTemplate(tx, userId, input, id)
    const [updated] = await tx
      .update(t.quickTemplates)
      .set(input)
      .where(ownTemplate(userId, id))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toTemplate(row)
}

export async function removeTemplate(userId: string, id: string) {
  await db.delete(t.quickTemplates).where(ownTemplate(userId, id))
}
