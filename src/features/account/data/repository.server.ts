import { eq } from 'drizzle-orm'

import { sha256 } from '#/features/auth/data/tokens.server'

import { newTotpSecret, otpauthUrl } from '#/features/auth/data/totp.server'

import { db } from '#/server/db/client'

import { users } from '#/server/db/schema'

import { ApiError } from '#/server/http/errors'

import type { profileInput } from './inputs.server'

import { rateLimit } from '#/server/http/rate-limit'

import { toUser } from '#/features/auth/data/mappers.server'

import {
  cancelPendingEmail,
  revokeSession,
  sendDeletionCode,
  sendEmailConfirmation,
  sessionsOf,
} from './notifications.server'

import type { z } from 'zod'

export async function currentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new ApiError('auth.no_session', 401)
  return user
}

export interface DemoFlag {
  isDemo: boolean
}

/** Konto demo jest tylko do oglądania aplikacji: bez zmian danych konta i bez płatności. */
export function assertNotDemo(user: DemoFlag) {
  if (user.isDemo) throw new ApiError('demo.restricted', 403)
}

export async function updateProfile(
  userId: string,
  input: z.infer<typeof profileInput>,
) {
  assertNotDemo(await currentUser(userId))
  const [user] = await db
    .update(users)
    .set({ displayName: input.displayName })
    .where(eq(users.id, userId))
    .returning()
  return toUser(user!)
}

/** Rezygnacja ze zmiany e-maila (link przestaje działać). */
export async function cancelEmailChange(userId: string) {
  await db.transaction((tx) => cancelPendingEmail(tx, userId))
  return
}

/** Ponowne wysłanie linku potwierdzającego adres. */
export async function resendVerification(userId: string) {
  rateLimit(`verify-resend:${userId}`, 3, 60 * 60_000)
  const user = await currentUser(userId)
  assertNotDemo(user)
  if (user.emailVerifiedAt) throw new ApiError('auth.already_verified', 409)
  await db.transaction((tx) => sendEmailConfirmation(tx, user, null))
  return
}

/** Początek włączania 2FA: nowy sekret do zeskanowania (zapisuje się dopiero po kodzie). */
export function setupTwoFactor(user: Awaited<ReturnType<typeof currentUser>>) {
  assertNotDemo(user)
  const secret = newTotpSecret()
  return { secret, otpauthUrl: otpauthUrl(secret, user.email) }
}

/** Urządzenia z aktywną sesją (rodziny refresh tokenów), bieżące oznaczone. */
export async function listSessions(
  userId: string,
  current: string | undefined,
) {
  return await sessionsOf(userId, current ? sha256(current) : null)
}

/** Wylogowanie jednego urządzenia. */
export async function revokeOwnSession(userId: string, id: string) {
  await db.transaction((tx) => revokeSession(tx, userId, id))
  return
}

/** Kod do usunięcia konta na adres konta (konto demo usuwa się samo po 24 h). */
export async function sendDeleteCode(userId: string) {
  rateLimit(`delete-code:${userId}`, 5, 60 * 60_000)
  const user = await currentUser(userId)
  assertNotDemo(user)
  await db.transaction((tx) => sendDeletionCode(tx, user))
  return
}
