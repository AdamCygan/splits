import type { Tx } from '#/server/db/client'
import { countRows, lowerName } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { conflict } from '#/server/http/errors'
import { and, eq, isNull, ne, sql } from 'drizzle-orm'

export async function ownProject(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.id, id), eq(t.projects.userId, userId)))
  return row
}

export const activeProjects = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.projects)
      .where(and(eq(t.projects.userId, userId), isNull(t.projects.archivedAt))),
  )

interface ProjectIdentity {
  name: string
  key: string | null
}

export async function assertProjectUnique(
  tx: Tx,
  userId: string,
  input: ProjectIdentity,
  exceptId?: string,
) {
  const others = await tx
    .select()
    .from(t.projects)
    .where(
      and(
        eq(t.projects.userId, userId),
        exceptId ? ne(t.projects.id, exceptId) : undefined,
      ),
    )
  if (others.some((p) => lowerName(p.name) === lowerName(input.name)))
    throw conflict('name_taken', 'name')
  if (input.key && others.some((p) => p.key === input.key))
    throw conflict('key_taken', 'key')
}
