import { LIMITS } from '#/features/task-types/domain/rules'
import { identity, password, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const profileInput = z.object({
  displayName: trimmed(1, LIMITS.displayName),
})

export const emailChangeInput = z.object({
  email: z.email().max(254),
  ...identity,
})

export const identityInput = z.object(identity)

export const totpEnableInput = z.object({
  secret: z.string().regex(/^[A-Z2-7]{16,64}$/),
  code: z.string().min(6).max(20),
  password: identity.password,
})

export const passwordChangeInput = z.object({
  currentPassword: z.string().max(LIMITS.passwordMax),
  newPassword: password,
})

/** Usunięcie konta: 6-cyfrowy kod z e-maila (POST /account/delete-code). */
export const deleteAccountInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
})
