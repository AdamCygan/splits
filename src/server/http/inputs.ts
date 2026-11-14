import { z } from 'zod'
import { isValidDate } from '#/domain/dates'
import {
  HEX_COLOR_RE,
  LIMITS,
  PROJECT_KEY_RE,
  ROUNDING_OPTIONS,
  TIME_RE,
  USERNAME_RE,
} from '#/domain/rules'
import { SUMMARY_TEMPLATE_MAX } from '#/domain/summary'
import { locales } from '#/i18n/config'
import type { Context } from 'hono'
import { invalid } from './errors'

/**
 * Walidacja kształtu danych wejściowych API. Reguły biznesowe (np. kolejność godzin,
 * wymagane pola zależne od typu pracy) sprawdzają potem te same funkcje co formularze (src/domain).
 */
const trimmed = (min: number, max: number) =>
  z.string().trim().min(min).max(max)
const uuid = z.uuid()
const color = z.string().regex(HEX_COLOR_RE)
const day = z.string().refine(isValidDate)
const time = z.string().regex(TIME_RE)
const requirement = z.enum(['hidden', 'optional', 'required'])
const sp = z.number().positive().max(100)
const locale = z.enum(locales)

export const timezone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz })
      return true
    } catch {
      return false
    }
  })

export const password = z
  .string()
  .min(LIMITS.passwordMin)
  .max(LIMITS.passwordMax)
  .regex(/\p{L}/u)
  .regex(/[0-9]/)

export const registerInput = z.object({
  username: z.string().trim().regex(USERNAME_RE),
  email: z.email().max(254),
  password,
  locale,
  timezone: timezone.optional(),
})

export const demoInput = z.object({
  locale: locale.default('en'),
  timezone: timezone.optional(),
})

export const loginInput = z.object({
  login: trimmed(1, 254),
  password: z.string().min(1).max(LIMITS.passwordMax),
})

export const emailInput = z.object({ email: z.email().max(254) })
export const resetInput = z.object({
  token: z.string().min(10).max(200),
  password,
})

export const profileInput = z.object({
  displayName: trimmed(1, LIMITS.displayName),
  email: z.email().max(254),
})

export const passwordChangeInput = z.object({
  currentPassword: z.string().max(LIMITS.passwordMax),
  newPassword: password,
})

export const deleteAccountInput = z.object({
  password: z.string().max(LIMITS.passwordMax),
})

export const settingsInput = z.object({
  workdayTargetMinutes: z
    .number()
    .int()
    .min(LIMITS.workdayMinutes.min)
    .max(LIMITS.workdayMinutes.max),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  weekStartsOn: z.number().int().min(0).max(6),
  timeRoundingMinutes: z.union(ROUNDING_OPTIONS.map((v) => z.literal(v))),
  timezone,
  locale,
  dailyReminderAt: time.nullable(),
  summaryTemplate: z.string().max(SUMMARY_TEMPLATE_MAX).nullable(),
})

export const scaleInput = z.object({
  steps: z
    .array(z.object({ points: z.number(), maxMinutes: z.number().int() }))
    .max(50),
})

export const taskTypeInput = z.object({
  name: trimmed(1, LIMITS.taskTypeName),
  color,
  titleLabel: trimmed(1, LIMITS.linkLabel),
  linkRequirement: requirement,
  linkLabel: z.string().trim().max(LIMITS.linkLabel),
  descriptionRequirement: requirement,
  storyPointsRequirement: requirement,
  defaultStoryPoints: sp.nullable(),
  defaultTimeInput: z.enum(['range', 'duration']),
  countsAsFocusWork: z.boolean(),
})

export const statusInput = z.object({
  name: trimmed(1, LIMITS.statusName),
  category: z.enum(['todo', 'in_progress', 'done']),
  color,
})

export const idsInput = z.object({ ids: z.array(uuid).max(500) })

export const cadenceInput = z.object({
  lengthDays: z
    .number()
    .int()
    .min(LIMITS.sprintLengthDays.min)
    .max(LIMITS.sprintLengthDays.max),
  anchorDate: day,
  namePattern: trimmed(1, LIMITS.sprintName),
  autoCreate: z.boolean(),
})

export const sprintInput = z.object({
  name: trimmed(1, LIMITS.sprintName),
  goal: z.string().trim().max(LIMITS.sprintGoal).nullable(),
  startsOn: day,
  endsOn: day,
  capacityStoryPoints: z.number().min(0).max(1000).nullable(),
})

export const projectInput = z.object({
  name: trimmed(1, LIMITS.projectName),
  key: z.string().regex(PROJECT_KEY_RE).nullable(),
  color,
})

export const tagInput = z.object({ name: trimmed(1, LIMITS.tagName), color })

const entryFields = {
  taskTypeId: uuid,
  projectId: uuid.nullable(),
  title: z.string().max(400),
  link: z.string().max(4096).nullable(),
  storyPoints: z.number().nullable(),
  workDate: day,
  note: z.string().max(4000).nullable(),
  // Starsze klienty nie wysyłają estymaty: brak pola = brak estymaty.
  estimateMinutes: z.number().int().min(1).max(60000).nullable().default(null),
}

export const entryInput = z.object({
  ...entryFields,
  startTime: time.nullable(),
  endTime: time.nullable(),
  durationMinutes: z.number().int().min(0).max(1440),
  // Starsze klienty nie wysyłają nadgodzin: brak pola = brak nadgodzin.
  overtimeMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  overtimeNote: z.string().max(4000).nullable().default(null),
  extensionMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  extensionNote: z.string().max(4000).nullable().default(null),
  running: z.boolean(),
})

export const timerInput = z.object({ ...entryFields, startTime: time })

/** Zmiana zadania we wszystkich jego wpisach (tytuł, link, projekt, SP). */
export const taskUpdateInput = z.object({
  ref: z.object({
    taskTypeId: uuid,
    title: z.string().max(400),
    link: z.string().max(4096).nullable(),
  }),
  title: z.string().max(400),
  link: z.string().max(4096).nullable(),
  projectId: uuid.nullable(),
  storyPoints: z.number().nullable(),
  /** Brak pola = estymata bez zmian (starsze klienty). */
  estimateMinutes: z.number().int().min(1).max(60000).nullable().optional(),
})

export const taskRefInput = z.object({
  taskTypeId: uuid,
  title: z.string().max(400),
  link: z.string().max(4096).optional(),
})

export const templateInput = z
  .object({
    taskTypeId: uuid,
    projectId: uuid.nullable(),
    askProject: z.boolean().default(false),
    label: trimmed(1, LIMITS.templateLabel),
    title: trimmed(1, LIMITS.templateTitle),
    storyPoints: sp.nullable(),
    defaultDurationMinutes: z
      .number()
      .int()
      .min(LIMITS.templateDuration.min)
      .max(LIMITS.templateDuration.max)
      .nullable(),
    hotkey: z.number().int().min(1).max(9).nullable(),
  })
  // Szablon „dowolny projekt” nie trzyma projektu: wybór pada przy użyciu.
  .transform((x) => (x.askProject ? { ...x, projectId: null } : x))

export const rangeQuery = z.object({ from: day, to: day })
export const dateQuery = z.object({ date: day })

/** Ciało żądania JSON zwalidowane schematem; błąd = 400 z nazwą pierwszego złego pola. */
export async function body<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  const raw: unknown = await c.req.json().catch(() => undefined)
  return parse(schema, raw)
}

export function parse<T extends z.ZodType>(
  schema: T,
  raw: unknown,
): z.infer<T> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const field = result.error.issues[0]?.path[0]
    throw invalid(typeof field === 'string' ? field : undefined)
  }
  return result.data
}
