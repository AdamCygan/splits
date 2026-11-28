import type { TaskStatus } from '#/features/task-statuses/data/dto'
import type * as schema from '#/server/db/schema'
import { isoDate } from '#/server/http/json'

export const toStatus = (
  taskStatusRow: typeof schema.taskStatuses.$inferSelect,
): TaskStatus => ({
  id: taskStatusRow.id,
  name: taskStatusRow.name,
  category: taskStatusRow.category,
  color: taskStatusRow.color,
  isSystem: taskStatusRow.isSystem,
  isDefault: taskStatusRow.isDefault,
  sortOrder: taskStatusRow.sortOrder,
  archivedAt: isoDate(taskStatusRow.archivedAt),
})
