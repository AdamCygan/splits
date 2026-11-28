import { eq, and, asc, ne, sql } from 'drizzle-orm'

import { cutAccess } from '#/features/auth/data/access.server'

import {
  hashPassword,
  verifyPassword,
} from '#/features/auth/data/passwords.server'

import { revokeOtherSessions, sha256 } from '#/features/auth/data/tokens.server'

import {
  encryptSecret,
  hashRecoveryCode,
  verifyTotp,
  newTotpSecret,
  otpauthUrl,
} from '#/features/auth/data/totp.server'

import { database } from '#/server/db/client'

import { users } from '#/server/db/schema'

import { ApiError, conflict } from '#/server/http/errors'

import type {
  deleteAccountInput,
  emailChangeInput,
  identityInput,
  passwordChangeInput,
  profileInput,
  totpEnableInput,
} from './inputs.server'

import { rateLimit } from '#/server/http/rate-limit'

import { billingEnabled } from '#/features/billing/data/stripe.server'

import { cancelSubscriptionsFor } from '#/features/billing/data/repository.server'

import { toUser } from '#/features/auth/data/mappers.server'

import {
  consumeDeletionCode,
  notify,
  confirmIdentity,
  disableTwoFactor,
  sendEmailConfirmation,
  cancelPendingEmail,
  revokeSession,
  sendDeletionCode,
  sessionsOf,
} from './notifications.server'

import type { z } from 'zod'

import * as schema from '#/server/db/schema'

export async function currentUser(userId: string) {
  const [user] = await database.select().from(users).where(eq(users.id, userId))
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
  const [user] = await database
    .update(users)
    .set({ displayName: input.displayName })
    .where(eq(users.id, userId))
    .returning()
  return toUser(user!)
}

/** Rezygnacja ze zmiany e-maila (link przestaje działać). */
export async function cancelEmailChange(userId: string) {
  await database.transaction((transaction) =>
    cancelPendingEmail(transaction, userId),
  )
  return
}

/** Ponowne wysłanie linku potwierdzającego adres. */
export async function resendVerification(userId: string) {
  rateLimit(`verify-resend:${userId}`, 3, 60 * 60_000)
  const user = await currentUser(userId)
  assertNotDemo(user)
  if (user.emailVerifiedAt) throw new ApiError('auth.already_verified', 409)
  await database.transaction((transaction) =>
    sendEmailConfirmation(transaction, user, null),
  )
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
  await database.transaction((transaction) =>
    revokeSession(transaction, userId, id),
  )
  return
}

/** Kod do usunięcia konta na adres konta (konto demo usuwa się samo po 24 h). */
export async function sendDeleteCode(userId: string) {
  rateLimit(`delete-code:${userId}`, 5, 60 * 60_000)
  const user = await currentUser(userId)
  assertNotDemo(user)
  await database.transaction((transaction) =>
    sendDeletionCode(transaction, user),
  )
  return
}

/**
 * Eksport wszystkich danych konta do pliku JSON (prawo do przenoszenia danych, RODO art. 20).
 * Bez haseł, tokenów i identyfikatorów Stripe.
 */
export async function exportAccount(userId: string) {
  const user = await currentUser(userId)
  const own = <T extends { userId: unknown }>(rows: Array<T>) =>
    rows.map(({ userId: _owner, ...rest }) => rest)
  const [
    settings,
    scale,
    types,
    statuses,
    cadence,
    sprints,
    projects,
    tags,
    templates,
    entries,
    subscriptions,
    daysOff,
    breaks,
    workspaces,
    workspaceSettings,
  ] = await Promise.all([
    database
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId)),
    database
      .select()
      .from(schema.storyPointScale)
      .where(eq(schema.storyPointScale.userId, userId)),
    database
      .select()
      .from(schema.taskTypes)
      .where(eq(schema.taskTypes.userId, userId)),
    database
      .select()
      .from(schema.taskStatuses)
      .where(eq(schema.taskStatuses.userId, userId)),
    database
      .select()
      .from(schema.sprintCadences)
      .where(eq(schema.sprintCadences.userId, userId)),
    database
      .select()
      .from(schema.sprints)
      .where(eq(schema.sprints.userId, userId))
      .orderBy(asc(schema.sprints.startsOn)),
    database
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId)),
    database.select().from(schema.tags).where(eq(schema.tags.userId, userId)),
    database
      .select()
      .from(schema.quickTemplates)
      .where(eq(schema.quickTemplates.userId, userId)),
    database
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.userId, userId))
      .orderBy(
        asc(schema.timeEntries.workDate),
        asc(schema.timeEntries.createdAt),
      ),
    database
      .select({
        status: schema.subscriptions.status,
        plan: schema.subscriptions.plan,
        currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd,
        createdAt: schema.subscriptions.createdAt,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId)),
    database
      .select()
      .from(schema.daysOff)
      .where(eq(schema.daysOff.userId, userId))
      .orderBy(asc(schema.daysOff.date)),
    database
      .select()
      .from(schema.breaks)
      .where(eq(schema.breaks.userId, userId))
      .orderBy(asc(schema.breaks.workDate), asc(schema.breaks.createdAt)),
    database
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.userId, userId))
      .orderBy(
        asc(schema.workspaces.sortOrder),
        asc(schema.workspaces.createdAt),
      ),
    database
      .select()
      .from(schema.workspaceSettings)
      .where(eq(schema.workspaceSettings.userId, userId)),
  ])
  return {
    format: 'splits-export',
    version: 2,
    exportedAt: new Date().toISOString(),
    account: {
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    settings: own(settings)[0] ?? null,
    // Każdy wiersz niżej ma workspaceId: przestrzeń, do której należy.
    workspaces: own(workspaces),
    workspaceSettings: own(workspaceSettings),
    storyPointScale: own(scale),
    taskTypes: own(types),
    taskStatuses: own(statuses),
    sprintCadences: own(cadence),
    sprints: own(sprints),
    projects: own(projects),
    tags: own(tags),
    quickTemplates: own(templates),
    timeEntries: own(entries),
    daysOff: own(daysOff),
    breaks: own(breaks),
    subscriptions,
  }
}

/**
 * Zmiana e-maila: hasło (i kod 2FA, jeśli włączone), potem link na nowy adres.
 * Adres zmienia się dopiero po kliknięciu, stary dostaje ostrzeżenie.
 */
export async function requestEmailChange(
  userId: string,
  input: z.infer<typeof emailChangeInput>,
  email: string,
) {
  await database.transaction(async (transaction) => {
    const user = await currentUser(userId)
    assertNotDemo(user)
    await confirmIdentity(transaction, user, input)
    const isSameEmail = email.toLowerCase() === user.email.toLowerCase()
    if (isSameEmail) throw new ApiError('auth.email_same', 400, 'email')
    const [taken] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, email.toLowerCase()),
          ne(users.id, userId),
        ),
      )
    if (taken) throw conflict('auth.email_taken', 'email')
    await sendEmailConfirmation(transaction, user, email)
  })
  return
}

/** Wyłączenie 2FA: hasło (jeśli jest) i aktualny kod albo kod zapasowy. */
export async function disableTwoFactorRequest(
  userId: string,
  input: z.infer<typeof identityInput>,
) {
  const user = await database.transaction(async (transaction) => {
    const account = await currentUser(userId)
    if (!account.totpEnabledAt) return account
    await confirmIdentity(transaction, account, input)
    await disableTwoFactor(transaction, userId)
    return account
  })
  await notify(user, 'twoFactorOff')
  return
}

/** Nowe kody zapasowe (stare przestają działać); wymaga kodu 2FA. */
export async function newRecoveryCodesRequest(
  userId: string,
  input: z.infer<typeof identityInput>,
  codes: string[],
) {
  await database.transaction(async (transaction) => {
    const user = await currentUser(userId)
    if (!user.totpEnabledAt)
      throw new ApiError('auth.invalid_code', 400, 'code')
    await confirmIdentity(transaction, user, input)
    await transaction
      .update(users)
      .set({ recoveryCodes: codes.map(hashRecoveryCode) })
      .where(eq(users.id, userId))
  })
  return { recoveryCodes: codes }
}

/** Włączenie 2FA: kod z aplikacji dla tego sekretu (+ hasło); zwraca kody zapasowe raz. */
export async function enableTwoFactorRequest(
  userId: string,
  input: z.infer<typeof totpEnableInput>,
  currentToken: string | undefined,
  codes: string[],
) {
  const user = await database.transaction(async (transaction) => {
    const account = await currentUser(userId)
    assertNotDemo(account)
    const isWrongPassword =
      account.passwordHash &&
      !(await verifyPassword(input.password ?? '', account.passwordHash))
    if (isWrongPassword)
      throw new ApiError('auth.wrong_password', 400, 'password')
    const step = verifyTotp(input.secret, input.code, null)
    const isInvalidCode = step === null
    if (isInvalidCode) throw new ApiError('auth.invalid_code', 400, 'code')
    await transaction
      .update(users)
      .set({
        totpSecret: encryptSecret(input.secret),
        totpEnabledAt: new Date(),
        totpLastStep: step,
        recoveryCodes: codes.map(hashRecoveryCode),
      })
      .where(eq(users.id, userId))
    // Pozostałe urządzenia logują się od nowa, już z drugim krokiem.
    await revokeOtherSessions(transaction, userId, currentToken)
    return account
  })
  await notify(user, 'twoFactorOn')
  return { recoveryCodes: codes }
}

/** Wylogowanie wszystkich urządzeń poza tym. */
export async function revokeOtherSessionsRequest(
  userId: string,
  currentToken: string | undefined,
) {
  await database.transaction((transaction) =>
    revokeOtherSessions(transaction, userId, currentToken),
  )
  return
}

export async function changePasswordRequest(
  userId: string,
  input: z.infer<typeof passwordChangeInput>,
  currentToken: string | undefined,
) {
  const user = await currentUser(userId)
  assertNotDemo(user)
  // Konto założone przez Google nie ma hasła: pierwsze hasło ustawia się bez obecnego.
  const isWrongPassword =
    user.passwordHash &&
    !(await verifyPassword(input.currentPassword, user.passwordHash))
  if (isWrongPassword)
    throw new ApiError('auth.wrong_password', 400, 'currentPassword')
  const passwordHash = await hashPassword(input.newPassword)
  await database.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(users.id, userId))
    await revokeOtherSessions(transaction, userId, currentToken)
  })
  await notify(user, 'passwordChanged')
  return
}

export async function deleteAccountRequest(
  userId: string,
  input: z.infer<typeof deleteAccountInput>,
) {
  const user = await currentUser(userId)
  await database.transaction((transaction) =>
    consumeDeletionCode(transaction, userId, input.code),
  )
  // Najpierw koniec płatności, potem ON DELETE CASCADE usuwa wszystkie dane konta.
  const isBillingEnabled = billingEnabled()
  if (isBillingEnabled) await cancelSubscriptionsFor(userId)
  await database.delete(users).where(eq(users.id, userId))
  await notify(user, 'accountDeleted')
  cutAccess(userId)
  return
}
