import type { QuickTemplate } from '#/features/templates/data/dto'
import type * as schema from '#/server/db/schema'

export const toTemplate = (
  quickTemplateRow: typeof schema.quickTemplates.$inferSelect,
): QuickTemplate => ({
  id: quickTemplateRow.id,
  taskTypeId: quickTemplateRow.taskTypeId,
  projectId: quickTemplateRow.projectId,
  askProject: quickTemplateRow.askProject,
  label: quickTemplateRow.label,
  title: quickTemplateRow.title,
  storyPoints: quickTemplateRow.storyPoints,
  defaultDurationMinutes: quickTemplateRow.defaultDurationMinutes,
  hotkey: quickTemplateRow.hotkey,
  sortOrder: quickTemplateRow.sortOrder,
  schedule: quickTemplateRow.schedule,
})
