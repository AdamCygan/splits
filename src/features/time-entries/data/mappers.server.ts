import type { TimeEntry } from '#/features/time-entries/data/dto'
import type * as t from '#/server/db/schema'
import { iso } from '#/server/http/json'

export const toEntry = (x: typeof t.timeEntries.$inferSelect): TimeEntry => ({
  id: x.id,
  taskTypeId: x.taskTypeId,
  projectId: x.projectId,
  title: x.title,
  link: x.link,
  storyPoints: x.storyPoints,
  workDate: x.workDate,
  startTime: x.startTime,
  endTime: x.endTime,
  durationMinutes: x.durationMinutes,
  note: x.note,
  overtimeMinutes: x.overtimeMinutes,
  overtimeNote: x.overtimeNote,
  estimateMinutes: x.estimateMinutes,
  extensionMinutes: x.extensionMinutes,
  extensionNote: x.extensionNote,
  finishedAt: x.finishedAt?.toISOString() ?? null,
  running: x.running,
  paused: x.paused,
  startedAt: iso(x.startedAt),
  createdAt: x.createdAt.toISOString(),
})
