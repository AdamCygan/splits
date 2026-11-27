import type { User } from '#/features/auth/data/dto'
import { z } from '#/lib/zod'

/** Kontrakt API (account): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

/** Ustawienia bezpieczeństwa konta (Ustawienia → Bezpieczeństwo). */
export interface SecurityStatus {
  emailVerified: boolean
  /** Nowy adres czekający na potwierdzenie linkiem. */
  pendingEmail: string | null
  twoFactor: boolean
  recoveryCodesLeft: number
  google: boolean
  hasPassword: boolean
}

/** Urządzenie z aktywną sesją. */
export interface ActiveSession {
  id: string
  userAgent: string | null
  ip: string | null
  startedAt: string
  lastActiveAt: string
  current: boolean
}

/** Hasło i/lub kod 2FA potwierdzające tożsamość. */
export interface IdentityInput {
  password?: string | null
  code?: string | null
}

export type ProfileInput = Pick<User, 'displayName'>

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

export const securityStatusSchema = z.object({
  emailVerified: z.boolean(),
  pendingEmail: z.string().nullable(),
  twoFactor: z.boolean(),
  recoveryCodesLeft: z.number(),
  google: z.boolean(),
  hasPassword: z.boolean(),
})

export const activeSessionSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  startedAt: z.string(),
  lastActiveAt: z.string(),
  current: z.boolean(),
})
