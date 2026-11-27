import type { TaskType } from '#/features/task-types/data/dto'
import type * as t from '#/server/db/schema'
import { iso } from '#/server/http/json'

export const toTaskType = (x: typeof t.taskTypes.$inferSelect): TaskType => ({
  id: x.id,
  kind: x.kind,
  name: x.name,
  color: x.color,
  isSystem: x.isSystem,
  titleLabel: x.titleLabel,
  linkRequirement: x.linkRequirement,
  linkLabel: x.linkLabel,
  descriptionRequirement: x.descriptionRequirement,
  storyPointsRequirement: x.storyPointsRequirement,
  defaultStoryPoints: x.defaultStoryPoints,
  defaultTimeInput: x.defaultTimeInput,
  countsAsFocusWork: x.countsAsFocusWork,
  sortOrder: x.sortOrder,
  archivedAt: iso(x.archivedAt),
})
