import type { TaskStatus } from '#/features/task-statuses/data/dto'
import type * as t from '#/server/db/schema'
import { iso } from '#/server/http/json'

export const toStatus = (
  x: typeof t.taskStatuses.$inferSelect,
): TaskStatus => ({
  id: x.id,
  name: x.name,
  category: x.category,
  color: x.color,
  isSystem: x.isSystem,
  isDefault: x.isDefault,
  sortOrder: x.sortOrder,
  archivedAt: iso(x.archivedAt),
})
