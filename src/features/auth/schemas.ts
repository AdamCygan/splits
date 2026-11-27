import { z } from '#/lib/zod'
import { LIMITS, USERNAME_RE } from '#/domain/rules'
import { fmt } from '#/i18n/format'
import type { AuthMessages } from '#/i18n/messages/auth'

/**
 * Schematy formularzy auth z komunikatami w języku użytkownika.
 * Te same reguły egzekwuje API (FluentValidation) i baza (CHECK).
 */
export function passwordSchema(v: AuthMessages['validation']) {
  return z
    .string()
    .min(LIMITS.passwordMin, fmt(v.passwordMin, { min: LIMITS.passwordMin }))
    .max(LIMITS.passwordMax, fmt(v.passwordMax, { max: LIMITS.passwordMax }))
    .regex(/\p{L}/u, v.passwordLetter)
    .regex(/[0-9]/, v.passwordDigit)
}

export function loginSchema(v: AuthMessages['validation']) {
  return z.object({
    login: z.string().trim().min(1, v.loginRequired),
    password: z.string().min(1, v.passwordRequired),
  })
}
export type LoginForm = z.infer<ReturnType<typeof loginSchema>>

export function registerSchema(v: AuthMessages['validation']) {
  return z.object({
    username: z.string().trim().regex(USERNAME_RE, v.username),
    email: z.email(v.email),
    password: passwordSchema(v),
    acceptTerms: z.boolean().refine((value) => value, v.terms),
  })
}
export type RegisterForm = z.infer<ReturnType<typeof registerSchema>>

export function forgotPasswordSchema(v: AuthMessages['validation']) {
  return z.object({ email: z.email(v.email) })
}
