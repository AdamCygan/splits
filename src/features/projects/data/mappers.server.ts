import type { Project } from '#/features/projects/data/dto'
import type * as t from '#/server/db/schema'
import { iso } from '#/server/http/json'

export const toProject = (x: typeof t.projects.$inferSelect): Project => ({
  id: x.id,
  name: x.name,
  key: x.key,
  color: x.color,
  archivedAt: iso(x.archivedAt),
})
