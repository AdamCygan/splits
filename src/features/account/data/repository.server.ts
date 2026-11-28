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

import { db } from '#/server/db/client'

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

import * as t from '#/server/db/schema'

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
    subs,
    daysOff,
    breaks,
    workspaces,
    workspaceSettings,
  ] = await Promise.all([
    db.select().from(t.userSettings).where(eq(t.userSettings.userId, userId)),
    db
      .select()
      .from(t.storyPointScale)
      .where(eq(t.storyPointScale.userId, userId)),
    db.select().from(t.taskTypes).where(eq(t.taskTypes.userId, userId)),
    db.select().from(t.taskStatuses).where(eq(t.taskStatuses.userId, userId)),
    db
      .select()
      .from(t.sprintCadences)
      .where(eq(t.sprintCadences.userId, userId)),
    db
      .select()
      .from(t.sprints)
      .where(eq(t.sprints.userId, userId))
      .orderBy(asc(t.sprints.startsOn)),
    db.select().from(t.projects).where(eq(t.projects.userId, userId)),
    db.select().from(t.tags).where(eq(t.tags.userId, userId)),
    db
      .select()
      .from(t.quickTemplates)
      .where(eq(t.quickTemplates.userId, userId)),
    db
      .select()
      .from(t.timeEntries)
      .where(eq(t.timeEntries.userId, userId))
      .orderBy(asc(t.timeEntries.workDate), asc(t.timeEntries.createdAt)),
    db
      .select({
        status: t.subscriptions.status,
        plan: t.subscriptions.plan,
        currentPeriodEnd: t.subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: t.subscriptions.cancelAtPeriodEnd,
        createdAt: t.subscriptions.createdAt,
      })
      .from(t.subscriptions)
      .where(eq(t.subscriptions.userId, userId)),
    db
      .select()
      .from(t.daysOff)
      .where(eq(t.daysOff.userId, userId))
      .orderBy(asc(t.daysOff.date)),
    db
      .select()
      .from(t.breaks)
      .where(eq(t.breaks.userId, userId))
      .orderBy(asc(t.breaks.workDate), asc(t.breaks.createdAt)),
    db
      .select()
      .from(t.workspaces)
      .where(eq(t.workspaces.userId, userId))
      .orderBy(asc(t.workspaces.sortOrder), asc(t.workspaces.createdAt)),
    db
      .select()
      .from(t.workspaceSettings)
      .where(eq(t.workspaceSettings.userId, userId)),
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
    subscriptions: subs,
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
  await db.transaction(async (tx) => {
    const user = await currentUser(userId)
    assertNotDemo(user)
    await confirmIdentity(tx, user, input)
    if (email.toLowerCase() === user.email.toLowerCase())
      throw new ApiError('auth.email_same', 400, 'email')
    const [taken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, email.toLowerCase()),
          ne(users.id, userId),
        ),
      )
    if (taken) throw conflict('auth.email_taken', 'email')
    await sendEmailConfirmation(tx, user, email)
  })
  return
}

/** Wyłączenie 2FA: hasło (jeśli jest) i aktualny kod albo kod zapasowy. */
export async function disableTwoFactorRequest(
  userId: string,
  input: z.infer<typeof identityInput>,
) {
  const user = await db.transaction(async (tx) => {
    const account = await currentUser(userId)
    if (!account.totpEnabledAt) return account
    await confirmIdentity(tx, account, input)
    await disableTwoFactor(tx, userId)
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
  await db.transaction(async (tx) => {
    const user = await currentUser(userId)
    if (!user.totpEnabledAt)
      throw new ApiError('auth.invalid_code', 400, 'code')
    await confirmIdentity(tx, user, input)
    await tx
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
  const user = await db.transaction(async (tx) => {
    const account = await currentUser(userId)
    assertNotDemo(account)
    if (
      account.passwordHash &&
      !(await verifyPassword(input.password ?? '', account.passwordHash))
    )
      throw new ApiError('auth.wrong_password', 400, 'password')
    const step = verifyTotp(input.secret, input.code, null)
    if (step === null) throw new ApiError('auth.invalid_code', 400, 'code')
    await tx
      .update(users)
      .set({
        totpSecret: encryptSecret(input.secret),
        totpEnabledAt: new Date(),
        totpLastStep: step,
        recoveryCodes: codes.map(hashRecoveryCode),
      })
      .where(eq(users.id, userId))
    // Pozostałe urządzenia logują się od nowa, już z drugim krokiem.
    await revokeOtherSessions(tx, userId, currentToken)
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
  await db.transaction((tx) => revokeOtherSessions(tx, userId, currentToken))
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
  if (
    user.passwordHash &&
    !(await verifyPassword(input.currentPassword, user.passwordHash))
  )
    throw new ApiError('auth.wrong_password', 400, 'currentPassword')
  const passwordHash = await hashPassword(input.newPassword)
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(users.id, userId))
    await revokeOtherSessions(tx, userId, currentToken)
  })
  await notify(user, 'passwordChanged')
  return
}

export async function deleteAccountRequest(
  userId: string,
  input: z.infer<typeof deleteAccountInput>,
) {
  const user = await currentUser(userId)
  await db.transaction((tx) => consumeDeletionCode(tx, userId, input.code))
  // Najpierw koniec płatności, potem ON DELETE CASCADE usuwa wszystkie dane konta.
  if (billingEnabled()) await cancelSubscriptionsFor(userId)
  await db.delete(users).where(eq(users.id, userId))
  await notify(user, 'accountDeleted')
  cutAccess(userId)
  return
}
