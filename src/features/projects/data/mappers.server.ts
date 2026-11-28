import type { Project } from '#/features/projects/data/dto'
import type * as schema from '#/server/db/schema'
import { isoDate } from '#/server/http/json'

export const toProject = (
  projectRow: typeof schema.projects.$inferSelect,
): Project => ({
  id: projectRow.id,
  name: projectRow.name,
  key: projectRow.key,
  color: projectRow.color,
  archivedAt: isoDate(projectRow.archivedAt),
})
