import { z } from '#/lib/zod'
import { LIMITS, USERNAME_RE } from '#/features/task-types/domain/rules'
import { fmt } from '#/i18n/format'
import type { AuthMessages } from '#/i18n/messages/auth'

/**
 * Schematy formularzy auth z komunikatami w języku użytkownika.
 * Te same reguły egzekwuje API (FluentValidation) i baza (CHECK).
 */
export function passwordSchema(validationMessages: AuthMessages['validation']) {
  return z
    .string()
    .min(
      LIMITS.passwordMin,
      fmt(validationMessages.passwordMin, { min: LIMITS.passwordMin }),
    )
    .max(
      LIMITS.passwordMax,
      fmt(validationMessages.passwordMax, { max: LIMITS.passwordMax }),
    )
    .regex(/\p{L}/u, validationMessages.passwordLetter)
    .regex(/[0-9]/, validationMessages.passwordDigit)
}

export function loginSchema(validationMessages: AuthMessages['validation']) {
  return z.object({
    login: z.string().trim().min(1, validationMessages.loginRequired),
    password: z.string().min(1, validationMessages.passwordRequired),
  })
}
export type LoginForm = z.infer<ReturnType<typeof loginSchema>>

export function registerSchema(validationMessages: AuthMessages['validation']) {
  return z.object({
    username: z.string().trim().regex(USERNAME_RE, validationMessages.username),
    email: z.email(validationMessages.email),
    password: passwordSchema(validationMessages),
    acceptTerms: z.boolean().refine((value) => value, validationMessages.terms),
  })
}
export type RegisterForm = z.infer<ReturnType<typeof registerSchema>>

export function forgotPasswordSchema(
  validationMessages: AuthMessages['validation'],
) {
  return z.object({ email: z.email(validationMessages.email) })
}
