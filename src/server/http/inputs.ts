import { readBody } from './body-limit'
import { invalid } from './errors'
import {
  HEX_COLOR_RE,
  LIMITS,
  TIME_RE,
} from '#/features/task-types/domain/rules'
import { locales } from '#/i18n/config'
import { isValidDate } from '#/shared/domain/dates'
import type { Context } from 'hono'
import { z } from 'zod'

/**
 * Walidacja kształtu danych wejściowych API. Reguły biznesowe (np. kolejność godzin,
 * wymagane pola zależne od typu pracy) sprawdzają potem te same funkcje co formularze (src/domain).
 */
export const trimmed = (min: number, max: number) =>
  z.string().trim().min(min).max(max)

export const uuid = z.uuid()

export const color = z.string().regex(HEX_COLOR_RE)

export const day = z.string().refine(isValidDate)

export const time = z.string().regex(TIME_RE)

export const requirement = z.enum(['hidden', 'optional', 'required'])

export const sp = z.number().positive().max(100)

export const locale = z.enum(locales)

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

/** Hasło i/lub kod 2FA potwierdzające tożsamość przed zmianą wrażliwych ustawień. */
export const identity = {
  password: z.string().max(LIMITS.passwordMax).nullish(),
  code: z.string().max(20).nullish(),
}

export const idsInput = z.object({ ids: z.array(uuid).max(500) })

export const rangeQuery = z.object({ from: day, to: day })

export const dateQuery = z.object({ date: day })

/** Ciało żądania JSON zwalidowane schematem; błąd = 400 z nazwą pierwszego złego pola. */
export async function body<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  const text = await readBody(c.req.raw)
  return parse(schema, parseJson(text))
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
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
