import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { cutAccess } from '../auth/access'
import { hashPassword, verifyPassword } from '../auth/passwords'
import { REFRESH_COOKIE, revokeOtherSessions, sha256 } from '../auth/tokens'
import {
  encryptSecret,
  hashRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from '../auth/totp'
import { db } from '../db/client'
import * as t from '../db/schema'
import { users } from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, conflict } from '../http/errors'
import {
  body,
  deleteAccountInput,
  emailChangeInput,
  identityInput,
  passwordChangeInput,
  profileInput,
  totpEnableInput,
} from '../http/inputs'
import { rateLimit } from '../http/rate-limit'
import { billingEnabled } from '../billing/stripe'
import { clearRefreshCookie } from './auth'
import { cancelSubscriptionsFor } from './billing'
import { toUser } from './dto'
import {
  cancelPendingEmail,
  confirmIdentity,
  consumeDeletionCode,
  disableTwoFactor,
  notify,
  revokeSession,
  securityStatus,
  sendDeletionCode,
  sendEmailConfirmation,
  sessionsOf,
} from './security'

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

export const accountRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(toUser(await currentUser(c.get('userId')))))

  /**
   * Eksport wszystkich danych konta do pliku JSON (prawo do przenoszenia danych, RODO art. 20).
   * Bez haseł, tokenów i identyfikatorów Stripe.
   */
  .get('/export', async (c) => {
    const userId = c.get('userId')
    rateLimit(`export:${userId}`, 10, 60 * 60_000)
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
    ])
    c.header(
      'Content-Disposition',
      `attachment; filename="timeblame-export-${new Date().toISOString().slice(0, 10)}.json"`,
    )
    return c.json({
      format: 'splits-export',
      version: 1,
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
      storyPointScale: own(scale),
      taskTypes: own(types),
      taskStatuses: own(statuses),
      sprintCadence: own(cadence)[0] ?? null,
      sprints: own(sprints),
      projects: own(projects),
      tags: own(tags),
      quickTemplates: own(templates),
      timeEntries: own(entries),
      daysOff: own(daysOff),
      breaks: own(breaks),
      subscriptions: subs,
    })
  })

  .put('/profile', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, profileInput)
    assertNotDemo(await currentUser(userId))
    const [user] = await db
      .update(users)
      .set({ displayName: input.displayName })
      .where(eq(users.id, userId))
      .returning()
    return c.json(toUser(user!))
  })

  /**
   * Zmiana e-maila: hasło (i kod 2FA, jeśli włączone), potem link na nowy adres.
   * Adres zmienia się dopiero po kliknięciu, stary dostaje ostrzeżenie.
   */
  .post('/email', async (c) => {
    const userId = c.get('userId')
    rateLimit(`email-change:${userId}`, 5, 60 * 60_000)
    const input = await body(c, emailChangeInput)
    const email = input.email.trim()
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
    return c.body(null, 204)
  })

  /** Rezygnacja ze zmiany e-maila (link przestaje działać). */
  .delete('/email/pending', async (c) => {
    await db.transaction((tx) => cancelPendingEmail(tx, c.get('userId')))
    return c.body(null, 204)
  })

  /** Ponowne wysłanie linku potwierdzającego adres. */
  .post('/email/verify', async (c) => {
    const userId = c.get('userId')
    rateLimit(`verify-resend:${userId}`, 3, 60 * 60_000)
    const user = await currentUser(userId)
    assertNotDemo(user)
    if (user.emailVerifiedAt) throw new ApiError('auth.already_verified', 409)
    await db.transaction((tx) => sendEmailConfirmation(tx, user, null))
    return c.body(null, 204)
  })

  /** Stan bezpieczeństwa: potwierdzenie adresu, oczekująca zmiana, 2FA, Google, kody. */
  .get('/security', async (c) =>
    c.json(await securityStatus(await currentUser(c.get('userId')))),
  )

  /** Początek włączania 2FA: nowy sekret do zeskanowania (zapisuje się dopiero po kodzie). */
  .post('/2fa/setup', async (c) => {
    const user = await currentUser(c.get('userId'))
    assertNotDemo(user)
    const secret = newTotpSecret()
    return c.json({ secret, otpauthUrl: otpauthUrl(secret, user.email) })
  })

  /** Włączenie 2FA: kod z aplikacji dla tego sekretu (+ hasło); zwraca kody zapasowe raz. */
  .post('/2fa/enable', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, totpEnableInput)
    const codes = newRecoveryCodes()
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
      await revokeOtherSessions(tx, userId, getCookie(c, REFRESH_COOKIE))
      return account
    })
    await notify(user, 'twoFactorOn')
    return c.json({ recoveryCodes: codes })
  })

  /** Wyłączenie 2FA: hasło (jeśli jest) i aktualny kod albo kod zapasowy. */
  .post('/2fa/disable', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, identityInput)
    const user = await db.transaction(async (tx) => {
      const account = await currentUser(userId)
      if (!account.totpEnabledAt) return account
      await confirmIdentity(tx, account, input)
      await disableTwoFactor(tx, userId)
      return account
    })
    await notify(user, 'twoFactorOff')
    return c.body(null, 204)
  })

  /** Nowe kody zapasowe (stare przestają działać); wymaga kodu 2FA. */
  .post('/2fa/recovery-codes', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, identityInput)
    const codes = newRecoveryCodes()
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
    return c.json({ recoveryCodes: codes })
  })

  /** Urządzenia z aktywną sesją (rodziny refresh tokenów), bieżące oznaczone. */
  .get('/sessions', async (c) => {
    const current = getCookie(c, REFRESH_COOKIE)
    return c.json(
      await sessionsOf(c.get('userId'), current ? sha256(current) : null),
    )
  })

  /** Wylogowanie jednego urządzenia. */
  .delete('/sessions/:id', async (c) => {
    await db.transaction((tx) =>
      revokeSession(tx, c.get('userId'), c.req.param('id')),
    )
    return c.body(null, 204)
  })

  /** Wylogowanie wszystkich urządzeń poza tym. */
  .post('/sessions/revoke-others', async (c) => {
    await db.transaction((tx) =>
      revokeOtherSessions(tx, c.get('userId'), getCookie(c, REFRESH_COOKIE)),
    )
    return c.body(null, 204)
  })

  .post('/password', async (c) => {
    const userId = c.get('userId')
    rateLimit(`password:${userId}`, 10, 15 * 60_000)
    const input = await body(c, passwordChangeInput)
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
      await revokeOtherSessions(tx, userId, getCookie(c, REFRESH_COOKIE))
    })
    await notify(user, 'passwordChanged')
    return c.body(null, 204)
  })

  /** Kod do usunięcia konta na adres konta (konto demo usuwa się samo po 24 h). */
  .post('/delete-code', async (c) => {
    const userId = c.get('userId')
    rateLimit(`delete-code:${userId}`, 5, 60 * 60_000)
    const user = await currentUser(userId)
    assertNotDemo(user)
    await db.transaction((tx) => sendDeletionCode(tx, user))
    return c.body(null, 204)
  })

  .delete('/', async (c) => {
    const userId = c.get('userId')
    // Kod ma 6 cyfr: limit prób na konto chroni przed zgadywaniem.
    rateLimit(`delete:${userId}`, 10, 15 * 60_000)
    const input = await body(c, deleteAccountInput)
    const user = await currentUser(userId)
    await db.transaction((tx) => consumeDeletionCode(tx, userId, input.code))
    // Najpierw koniec płatności, potem ON DELETE CASCADE usuwa wszystkie dane konta.
    if (billingEnabled()) await cancelSubscriptionsFor(userId)
    await db.delete(users).where(eq(users.id, userId))
    await notify(user, 'accountDeleted')
    cutAccess(userId)
    clearRefreshCookie(c)
    return c.body(null, 204)
  })
