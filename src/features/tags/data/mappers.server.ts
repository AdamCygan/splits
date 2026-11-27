import type { Tag } from '#/features/tags/data/dto'
import type * as t from '#/server/db/schema'

export const toTag = (x: typeof t.tags.$inferSelect): Tag => ({
  id: x.id,
  name: x.name,
  color: x.color,
})
