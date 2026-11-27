import { ownProject } from '#/features/projects/data/repository.server'
import { ownTaskType } from '#/features/task-types/data/repository.server'
import type { Tx } from '#/server/db/client'
import { countRows } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { ApiError, conflict, invalid } from '#/server/http/errors'
import { asc, eq, sql } from 'drizzle-orm'

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
