import { z } from 'zod'

/** Schematy odpowiedzi API — dane z sieci są walidowane, a nie rzutowane na ślepo. */
const id = z.string()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const requirement = z.enum(['hidden', 'optional', 'required'])
const workKind = z.enum([
  'task',
  'code_review',
  'pair_programming',
  'additional_work',
  'meeting',
  'custom',
])

export const planSchema = z.enum(['free', 'pro', 'lifetime'])

export const userSchema = z.object({
  id,
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['client', 'manager', 'admin']),
  plan: planSchema,
  hasPassword: z.boolean(),
  isDemo: z.boolean().default(false),
})

export const sessionSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})

export const settingsSchema = z.object({
  workdayTargetMinutes: z.number().int(),
  workingDays: z.array(z.number().int().min(0).max(6)),
  weekStartsOn: z.number().int().min(0).max(6),
  timeRoundingMinutes: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(30),
  ]),
  timezone: z.string(),
  summaryTemplate: z.string().nullable().default(null),
  breakMinutes: z.number().int().default(30),
  locale: z.enum(['en', 'pl']),
  dailyReminderAt: z.string().nullable(),
})

export const scaleSchema = z.array(
  z.object({ id, points: z.number(), maxMinutes: z.number().int() }),
)

export const taskTypeSchema = z.object({
  id,
  kind: workKind,
  name: z.string(),
  color: z.string(),
  isSystem: z.boolean(),
  titleLabel: z.string(),
  linkRequirement: requirement,
  linkLabel: z.string(),
  descriptionRequirement: requirement,
  storyPointsRequirement: requirement,
  defaultStoryPoints: z.number().nullable(),
  defaultTimeInput: z.enum(['range', 'duration']),
  countsAsFocusWork: z.boolean(),
  sortOrder: z.number().int(),
  archivedAt: z.string().nullable(),
})

export const statusSchema = z.object({
  id,
  name: z.string(),
  category: z.enum(['todo', 'in_progress', 'done']),
  color: z.string(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  archivedAt: z.string().nullable(),
})

export const cadenceSchema = z
  .object({
    lengthDays: z.number().int(),
    anchorDate: date,
    namePattern: z.string(),
    autoCreate: z.boolean(),
  })
  .nullable()

export const sprintSchema = z.object({
  id,
  number: z.number().int().nullable(),
  name: z.string(),
  goal: z.string().nullable(),
  startsOn: date,
  endsOn: date,
  capacityStoryPoints: z.number().nullable(),
  timeGoals: z
    .array(z.object({ taskTypeId: z.string(), minutes: z.number() }))
    .default([]),
  fromCadence: z.boolean(),
})

export const projectSchema = z.object({
  id,
  name: z.string(),
  key: z.string().nullable(),
  color: z.string(),
  archivedAt: z.string().nullable(),
})

export const tagSchema = z.object({ id, name: z.string(), color: z.string() })

export const timeEntrySchema = z.object({
  id,
  taskTypeId: id,
  projectId: id.nullable(),
  title: z.string(),
  link: z.string().nullable(),
  storyPoints: z.number().nullable(),
  workDate: date,
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().int(),
  note: z.string().nullable(),
  overtimeMinutes: z.number().int().nullable().default(null),
  overtimeNote: z.string().nullable().default(null),
  estimateMinutes: z.number().int().nullable().default(null),
  extensionMinutes: z.number().int().nullable().default(null),
  extensionNote: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  running: z.boolean(),
  paused: z.boolean(),
  startedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const templateSchema = z.object({
  id,
  taskTypeId: id,
  projectId: id.nullable(),
  askProject: z.boolean().default(false),
  label: z.string(),
  title: z.string(),
  storyPoints: z.number().nullable(),
  defaultDurationMinutes: z.number().int().nullable(),
  hotkey: z.number().int().nullable(),
  sortOrder: z.number().int(),
  schedule: z
    .array(z.object({ day: z.number().int(), time: z.string() }))
    .default([]),
})

export const billingSchema = z.object({
  enabled: z.boolean(),
  plan: planSchema,
  subscription: z
    .object({
      status: z.string(),
      plan: planSchema,
      active: z.boolean(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
})

export const bootstrapSchema = z.object({
  user: userSchema,
  settings: settingsSchema,
  taskTypes: z.array(taskTypeSchema),
  scale: scaleSchema,
  projects: z.array(projectSchema),
  templates: z.array(templateSchema),
  today: date,
  entries: z.array(timeEntrySchema),
  paused: z.array(timeEntrySchema),
  running: timeEntrySchema.nullable(),
})

export const adminUserSchema = z.object({
  id,
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['client', 'manager', 'admin']),
  plan: planSchema,
  isDemo: z.boolean(),
  hasPassword: z.boolean(),
  emailVerified: z.boolean(),
  isOwner: z.boolean().default(false),
  disabledAt: z.string().nullable(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  entries: z.number().int(),
  lastEntryOn: z.string().nullable(),
  subscription: z
    .object({
      status: z.string(),
      active: z.boolean(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
})

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

export const adminStatsSchema = z.object({
  users: z.number().int(),
  new7: z.number().int(),
  new30: z.number().int(),
  active7: z.number().int(),
  free: z.number().int(),
  pro: z.number().int(),
  lifetime: z.number().int(),
  blocked: z.number().int(),
  demo: z.number().int(),
  activeSubscriptions: z.number().int(),
  yearlyRevenue: z.number(),
  signups: z.array(z.object({ day: date, count: z.number().int() })),
})

export const adminActionSchema = z.object({
  id,
  adminEmail: z.string(),
  targetEmail: z.string(),
  action: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
})

export const dayOffSchema = z.object({
  date: z.string(),
  kind: z.enum(['vacation', 'sick', 'holiday', 'other']),
  note: z.string().nullable(),
})

export const workBreakSchema = z.object({
  id: z.string(),
  workDate: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().int(),
  running: z.boolean(),
  startedAt: z.string().nullable(),
  resumeEntryId: z.string().nullable(),
})
