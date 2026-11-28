import type { TaskType } from '#/features/task-types/data/dto'
import type * as schema from '#/server/db/schema'
import { isoDate } from '#/server/http/json'

export const toTaskType = (
  taskTypeRow: typeof schema.taskTypes.$inferSelect,
): TaskType => ({
  id: taskTypeRow.id,
  kind: taskTypeRow.kind,
  name: taskTypeRow.name,
  color: taskTypeRow.color,
  isSystem: taskTypeRow.isSystem,
  titleLabel: taskTypeRow.titleLabel,
  linkRequirement: taskTypeRow.linkRequirement,
  linkLabel: taskTypeRow.linkLabel,
  descriptionRequirement: taskTypeRow.descriptionRequirement,
  storyPointsRequirement: taskTypeRow.storyPointsRequirement,
  defaultStoryPoints: taskTypeRow.defaultStoryPoints,
  defaultTimeInput: taskTypeRow.defaultTimeInput,
  countsAsFocusWork: taskTypeRow.countsAsFocusWork,
  sortOrder: taskTypeRow.sortOrder,
  archivedAt: isoDate(taskTypeRow.archivedAt),
})
