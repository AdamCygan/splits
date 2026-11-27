import { and, asc, eq } from 'drizzle-orm'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { notFound } from '#/server/http/errors'
import type { TagInput } from './dto'
import { toTag } from './mappers.server'

const ownTag = (userId: string, id: string) =>
  and(eq(t.tags.id, id), eq(t.tags.userId, userId))

/** Tagi konta, alfabetycznie. */
export async function listTags(userId: string) {
  const rows = await db
    .select()
    .from(t.tags)
    .where(eq(t.tags.userId, userId))
    .orderBy(asc(t.tags.name))
  return rows.map(toTag)
}

export async function createTag(userId: string, input: TagInput) {
  const [created] = await db
    .insert(t.tags)
    .values({ ...input, userId })
    .returning()
  return toTag(created!)
}

export async function updateTag(userId: string, id: string, input: TagInput) {
  const [row] = await db
    .update(t.tags)
    .set(input)
    .where(ownTag(userId, id))
    .returning()
  if (!row) throw notFound()
  return toTag(row)
}

export async function removeTag(userId: string, id: string) {
  await db.delete(t.tags).where(ownTag(userId, id))
}
