import type { Locale } from '#/i18n/config'
import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (auth): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export type UserRole = 'client' | 'manager' | 'admin'

export type PlanCode = 'free' | 'pro' | 'lifetime'

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  role: UserRole
  plan: PlanCode
  /** false = konto założone przez Google, bez hasła. */
  hasPassword: boolean
  /** Konto demo z przykładowymi danymi (bez zakupów i zmian konta, usuwane po 24 h). */
  isDemo: boolean
  /** Adres potwierdzony linkiem z e-maila (albo przez Google). */
  emailVerified: boolean
}

export interface AuthSession {
  accessToken: string
  expiresAt: string
  user: User
}

/** Wynik logowania hasłem: sesja albo prośba o kod 2FA (bilet ważny 5 min). */
export type LoginResult = AuthSession | { mfaRequired: true; mfaToken: string }

export interface RegisterInput {
  username: string
  email: string
  password: string
  locale: Locale
  /** Strefa IANA przeglądarki: od niej zależy „dziś” i sprinty. */
  timezone?: string
}

export interface LoginInput {
  login: string
  password: string
}

export const planSchema = z.enum(['free', 'pro', 'lifetime'])

export const userSchema = z.object({
  id: idSchema,
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['client', 'manager', 'admin']),
  plan: planSchema,
  hasPassword: z.boolean(),
  isDemo: z.boolean().default(false),
  emailVerified: z.boolean().default(true),
})

export const loginResultSchema = z.union([
  z.object({ mfaRequired: z.literal(true), mfaToken: z.string() }),
  z.object({
    accessToken: z.string(),
    expiresAt: z.string(),
    user: userSchema,
  }),
])

export const sessionSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
