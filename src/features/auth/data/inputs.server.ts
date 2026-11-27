import { LIMITS, USERNAME_RE } from '#/features/task-types/domain/rules'
import { locale, password, timezone, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

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

export const tokenInput = z.object({ token: z.string().min(10).max(200) })

export const mfaLoginInput = z.object({
  mfaToken: z.string().min(10).max(2000),
  code: z.string().min(6).max(20),
})
