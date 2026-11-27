import type {
  Project,
  QuickTemplate,
  SpScaleStep,
  Sprint,
  SprintCadence,
  Tag,
  TaskStatus,
  TaskType,
  TimeEntry,
  User,
  UserSettings,
} from '#/data/types'
import type { Locale } from '#/i18n/config'
import type * as t from '../db/schema'

/** Wiersze z bazy → kształt z kontraktu API (src/data/types.ts), daty jako ISO 8601. */
/** Data z bazy jako ISO 8601 albo null (format dat w odpowiedziach API). */
export const iso = (d: Date | null) => (d ? d.toISOString() : null)

export const toUser = (u: typeof t.users.$inferSelect): User => ({
  id: u.id,
  username: u.username,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  plan: u.plan,
  hasPassword: u.passwordHash !== null,
  isDemo: u.isDemo,
})

export const toSettings = (
  s: typeof t.userSettings.$inferSelect,
): UserSettings => ({
  workdayTargetMinutes: s.workdayTargetMinutes,
  workingDays: [...s.workingDays].sort((a, b) => a - b),
  weekStartsOn: s.weekStartsOn,
  timeRoundingMinutes:
    s.timeRoundingMinutes as UserSettings['timeRoundingMinutes'],
  timezone: s.timezone,
  locale: s.locale as Locale,
  dailyReminderAt: s.dailyReminderAt,
  summaryTemplate: s.summaryTemplate,
  breakMinutes: s.breakMinutes,
})

export const toScaleStep = (
  s: typeof t.storyPointScale.$inferSelect,
): SpScaleStep => ({ id: s.id, points: s.points, maxMinutes: s.maxMinutes })

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

export const toCadence = (
  x: typeof t.sprintCadences.$inferSelect | undefined,
): SprintCadence | null =>
  x
    ? {
        lengthDays: x.lengthDays,
        anchorDate: x.anchorDate,
        namePattern: x.namePattern,
        autoCreate: x.autoCreate,
      }
    : null

export const toSprint = (x: typeof t.sprints.$inferSelect): Sprint => ({
  id: x.id,
  number: x.number,
  name: x.name,
  goal: x.goal,
  startsOn: x.startsOn,
  endsOn: x.endsOn,
  capacityStoryPoints: x.capacityStoryPoints,
  timeGoals: x.timeGoals,
  fromCadence: x.fromCadence,
})

export const toProject = (x: typeof t.projects.$inferSelect): Project => ({
  id: x.id,
  name: x.name,
  key: x.key,
  color: x.color,
  archivedAt: iso(x.archivedAt),
})

export const toTag = (x: typeof t.tags.$inferSelect): Tag => ({
  id: x.id,
  name: x.name,
  color: x.color,
})

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
