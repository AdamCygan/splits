import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { notFound } from '#/server/http/errors'
import type { TagInput } from './dto'
import { toTag } from './mappers.server'

const ownTag = (scope: Scope, id: string) =>
  and(eq(t.tags.id, id), inScope(t.tags, scope))

/** Tagi konta, alfabetycznie. */
export async function listTags(scope: Scope) {
  const rows = await db
    .select()
    .from(t.tags)
    .where(inScope(t.tags, scope))
    .orderBy(asc(t.tags.name))
  return rows.map(toTag)
}

export async function createTag(scope: Scope, input: TagInput) {
  const [created] = await db
    .insert(t.tags)
    .values({ ...input, ...owner(scope) })
    .returning()
  return toTag(created!)
}

export async function updateTag(scope: Scope, id: string, input: TagInput) {
  const [row] = await db
    .update(t.tags)
    .set(input)
    .where(ownTag(scope, id))
    .returning()
  if (!row) throw notFound()
  return toTag(row)
}

export async function removeTag(scope: Scope, id: string) {
  await db.delete(t.tags).where(ownTag(scope, id))
}
