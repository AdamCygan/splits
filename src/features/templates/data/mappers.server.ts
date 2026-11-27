import type { QuickTemplate } from '#/features/templates/data/dto'
import type * as t from '#/server/db/schema'

export const toTemplate = (
  x: typeof t.quickTemplates.$inferSelect,
): QuickTemplate => ({
  id: x.id,
  taskTypeId: x.taskTypeId,
  projectId: x.projectId,
  askProject: x.askProject,
  label: x.label,
  title: x.title,
  storyPoints: x.storyPoints,
  defaultDurationMinutes: x.defaultDurationMinutes,
  hotkey: x.hotkey,
  sortOrder: x.sortOrder,
  schedule: x.schedule,
})
