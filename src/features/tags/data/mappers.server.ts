import type { Tag } from '#/features/tags/data/dto'
import type * as schema from '#/server/db/schema'

export const toTag = (tagRow: typeof schema.tags.$inferSelect): Tag => ({
  id: tagRow.id,
  name: tagRow.name,
  color: tagRow.color,
})
