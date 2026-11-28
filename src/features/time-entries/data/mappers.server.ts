import type { TimeEntry } from '#/features/time-entries/data/dto'
import type * as schema from '#/server/db/schema'
import { isoDate } from '#/server/http/json'

export const toEntry = (
  timeEntryRow: typeof schema.timeEntries.$inferSelect,
): TimeEntry => ({
  id: timeEntryRow.id,
  taskTypeId: timeEntryRow.taskTypeId,
  projectId: timeEntryRow.projectId,
  title: timeEntryRow.title,
  link: timeEntryRow.link,
  storyPoints: timeEntryRow.storyPoints,
  workDate: timeEntryRow.workDate,
  startTime: timeEntryRow.startTime,
  endTime: timeEntryRow.endTime,
  durationMinutes: timeEntryRow.durationMinutes,
  note: timeEntryRow.note,
  overtimeMinutes: timeEntryRow.overtimeMinutes,
  overtimeNote: timeEntryRow.overtimeNote,
  estimateMinutes: timeEntryRow.estimateMinutes,
  extensionMinutes: timeEntryRow.extensionMinutes,
  extensionNote: timeEntryRow.extensionNote,
  finishedAt: timeEntryRow.finishedAt?.toISOString() ?? null,
  running: timeEntryRow.running,
  paused: timeEntryRow.paused,
  startedAt: isoDate(timeEntryRow.startedAt),
  createdAt: timeEntryRow.createdAt.toISOString(),
})
