import type {
  demoInput,
  emailInput,
  loginInput,
  mfaLoginInput,
  registerInput,
  resetInput,
  tokenInput,
} from './inputs.server'

import { toUser } from './mappers.server'

import {
  burnPasswordCheck,
  hashPassword,
  verifyPassword,
} from './passwords.server'

import {
  issueRefreshToken,
  randomToken,
  revokeAllSessions,
  revokeToken,
  rotateRefreshToken,
  sha256,
  signAccessToken,
  signMfaToken,
  verifyMfaToken,
} from './tokens.server'

import type { ClientMeta } from './tokens.server'

import { createAccountData } from './workspace.server'

import type { requestMeta } from '../controllers/http.server'

import {
  notify,
  sendEmailConfirmation,
  useSecondFactor,
} from '#/features/account/data/notifications.server'

import type { AuthSession } from '#/features/auth/data/dto'

import { USERNAME_RE } from '#/features/task-types/domain/rules'

import type { Locale } from '#/i18n/config'

import { database } from '#/server/db/client'

import type { Tx } from '#/server/db/client'

import {
  authTokens,
  externalLogins,
  refreshTokens,
  users,
} from '#/server/db/schema'

import { passwordResetEmail, sendEmail } from '#/server/email'

import { serverEnv } from '#/server/env'

import { ApiError, conflict } from '#/server/http/errors'

import { timezone as timezoneSchema } from '#/server/http/inputs'

import { rateLimit, resetRateLimit } from '#/server/http/rate-limit'

import { runMaintenance } from '#/server/maintenance'

import { and, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm'

import { randomUUID } from 'node:crypto'

import type { z } from 'zod'

export const MAX_FAILED_LOGINS = 10

export const LOCKOUT_MINUTES = 15

export const RESET_TOKEN_MINUTES = 60

/** Górny limit żywych kont demo: chroni bazę przed zalaniem. */
export const DEMO_MAX_ACCOUNTS = 500

export const lower = (value: string) => value.trim().toLowerCase()

/** Czy konto należy do właściciela aplikacji (ADMIN_EMAILS) i ma potwierdzony adres. */
export const isOwner = (
  user: Pick<typeof users.$inferSelect, 'email' | 'emailVerifiedAt' | 'isDemo'>,
) =>
  !user.isDemo &&
  user.emailVerifiedAt !== null &&
  serverEnv.adminEmails.has(user.email.toLowerCase())

/**
 * Właściciel dostaje rolę admina przy logowaniu i odświeżeniu sesji. Tylko z potwierdzonym
 * adresem (Google albo hasło ustawione z linku z e-maila): rejestracja nie sprawdza adresu,
 * więc bez tego obcy mógłby założyć konto na e-mail właściciela i przejąć panel.
 */
export async function promoteOwner(
  transaction: Tx,
  user: typeof users.$inferSelect,
) {
  const needsNoPromotion = user.role === 'admin' || !isOwner(user)
  if (needsNoPromotion) return user
  const [promoted] = await transaction
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.id, user.id))
    .returning()
  return promoted ?? user
}

export interface OpenedSession {
  session: AuthSession
  /** Refresh token do ciasteczka httpOnly (ustawia go trasa). */
  refreshToken: string
}

/** Nowa sesja: refresh token w bazie i krótki access token (konto właściciela dostaje rolę admina). */
export async function openSession(
  transaction: Tx,
  account: typeof users.$inferSelect,
  meta: ClientMeta,
): Promise<OpenedSession> {
  const user = await promoteOwner(transaction, account)
  const refreshToken = await issueRefreshToken(transaction, user.id, meta)
  const access = await signAccessToken(user.id)
  return {
    session: {
      accessToken: access.token,
      expiresAt: access.expiresAt.toISOString(),
      user: toUser(user),
    },
    refreshToken,
  }
}

export async function findUserByLogin(transaction: Tx, login: string) {
  const key = lower(login)
  const [user] = await transaction
    .select()
    .from(users)
    .where(
      or(
        eq(sql`lower(${users.username})`, key),
        eq(sql`lower(${users.email})`, key),
      ),
    )
  return user
}

export async function assertAvailable(
  transaction: Tx,
  username: string,
  email: string,
) {
  const [byName] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, lower(username)))
  if (byName) throw conflict('auth.username_taken', 'username')
  const [byEmail] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, lower(email)))
  if (byEmail) throw conflict('auth.email_taken', 'email')
}

export interface NewAccount {
  username: string
  email: string
  displayName: string
  passwordHash: string | null
  locale: Locale
  timezone: string
  emailVerified?: boolean
  withSamples?: boolean
  /** Konto demo: plan Pro na czas pokazu, usuwane po 24 h. */
  demo?: boolean
}

/** Tworzy konto z danymi startowymi; używane przez rejestrację, Google i testy e2e. */
export async function createAccount(transaction: Tx, input: NewAccount) {
  const [user] = await transaction
    .insert(users)
    .values({
      username: input.username,
      email: input.email.trim(),
      displayName: input.displayName.slice(0, 80),
      passwordHash: input.passwordHash,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      passwordChangedAt: input.passwordHash ? new Date() : null,
      lastLoginAt: new Date(),
      ...(input.demo ? { isDemo: true, plan: 'pro' as const } : {}),
    })
    .returning()
  await createAccountData(
    transaction,
    user!.id,
    input.locale,
    input.timezone,
    input.withSamples,
  )
  return user!
}

export async function uniqueUsername(transaction: Tx, email: string) {
  const base =
    email
      .split('@')[0]!
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/^[^A-Za-z0-9]+/, '')
      .slice(0, 24) || 'user'
  const stem = base.length >= 3 ? base : `${base}user`
  for (let index = 0; index < 20; index++) {
    const candidate =
      index === 0 ? stem : `${stem}${Math.floor(Math.random() * 9000) + 1000}`
    const isInvalidUsername = !USERNAME_RE.test(candidate)
    if (isInvalidUsername) continue
    const [taken] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.username})`, candidate.toLowerCase()))
    if (!taken) return candidate
  }
  return `user${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export interface GoogleClaims {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
}

export interface GoogleOutcome {
  /** Konto zablokowane przez administratora. */
  blocked: boolean
  /** Konto z 2FA: kod wpisuje się na stronie logowania. */
  mfaToken?: string
  opened?: OpenedSession
}

/**
 * Logowanie Google: powiązane konto, konto z tym samym adresem (przejęte, jeśli adres był
 * niepotwierdzony) albo nowe konto. Sesja tylko bez blokady i bez 2FA.
 */
export async function signInWithGoogle(
  claims: GoogleClaims & { email: string },
  locale: Locale,
  timeZone: string,
  meta: ClientMeta,
) {
  const email = claims.email
  const outcome: GoogleOutcome = { blocked: false }
  await database.transaction(async (transaction) => {
    const [link] = await transaction
      .select({ userId: externalLogins.userId })
      .from(externalLogins)
      .where(
        and(
          eq(externalLogins.provider, 'google'),
          eq(externalLogins.providerUserId, claims.sub),
        ),
      )
    let user = link
      ? (
          await transaction
            .select()
            .from(users)
            .where(eq(users.id, link.userId))
        )[0]
      : undefined
    if (!user) {
      // Konto z tym samym (zweryfikowanym przez Google) adresem dostaje powiązanie z Google.
      user = (
        await transaction
          .select()
          .from(users)
          .where(eq(sql`lower(${users.email})`, lower(email)))
      )[0]
      // Konto z niepotwierdzonym adresem mógł założyć ktoś obcy, znając tylko e-mail:
      // właściciel adresu (Google to potwierdził) przejmuje je bez cudzego hasła, 2FA i sesji.
      const unverifiedUser = user?.emailVerifiedAt ? undefined : user
      if (unverifiedUser) {
        await revokeAllSessions(transaction, unverifiedUser.id)
        ;[user] = await transaction
          .update(users)
          .set({
            passwordHash: null,
            totpSecret: null,
            totpEnabledAt: null,
            recoveryCodes: [],
            emailVerifiedAt: new Date(),
          })
          .where(eq(users.id, unverifiedUser.id))
          .returning()
      }
      user ??= await createAccount(transaction, {
        username: await uniqueUsername(transaction, email),
        email,
        displayName: claims.name?.trim() || email.split('@')[0]!,
        passwordHash: null,
        locale,
        timezone: timezoneSchema.safeParse(timeZone).success ? timeZone : 'UTC',
        emailVerified: true,
      })
      await transaction
        .insert(externalLogins)
        .values({
          provider: 'google',
          providerUserId: claims.sub,
          userId: user.id,
        })
        .onConflictDoNothing()
    }
    if (user.disabledAt) {
      outcome.blocked = true
      return
    }
    // 2FA: Google potwierdził tożsamość, ale kod z aplikacji wpisuje się na stronie logowania.
    if (user.totpEnabledAt) {
      outcome.mfaToken = await signMfaToken(user.id)
      return
    }
    const [fresh] = await transaction
      .update(users)
      .set({
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()
    outcome.opened = await openSession(transaction, fresh!, meta)
  })
  return outcome
}

/** Nowy refresh token w miejsce starego (rotacja); null = sesja wygasła, odwołana albo konto zablokowane. */
export async function refreshSession(
  token: string,
  meta: ClientMeta,
): Promise<OpenedSession | null> {
  return database.transaction(async (transaction) => {
    const rotated = await rotateRefreshToken(transaction, token, meta)
    if (!rotated.ok) return null
    const [found] = await transaction
      .select()
      .from(users)
      .where(eq(users.id, rotated.userId))
    const isMissingOrDisabled = !found || found.disabledAt
    if (isMissingOrDisabled) return null
    const user = await promoteOwner(transaction, found)
    const access = await signAccessToken(user.id)
    return {
      session: {
        accessToken: access.token,
        expiresAt: access.expiresAt.toISOString(),
        user: toUser(user),
      },
      refreshToken: rotated.token,
    }
  })
}

export async function registerAccount(
  meta: ReturnType<typeof requestMeta>,
  input: z.infer<typeof registerInput>,
) {
  const passwordHash = await hashPassword(input.password)
  const session = await database.transaction(async (transaction) => {
    await assertAvailable(transaction, input.username, input.email)
    const user = await createAccount(transaction, {
      username: input.username,
      email: input.email,
      displayName: input.username,
      passwordHash,
      locale: input.locale,
      timezone: input.timezone ?? 'UTC',
    })
    // Link potwierdzający adres: bez tego reset hasła i e-maile mogłyby trafiać do obcych.
    await sendEmailConfirmation(transaction, user, null)
    return openSession(transaction, user, meta)
  })
  return session
}

/**
 * Konto demo bez rejestracji: jednorazowe konto z przykładowymi danymi i planem Pro.
 * Nie ma hasła ani prawdziwego adresu, nie może kupować ani zmieniać danych konta,
 * a po 24 h jest usuwane (src/server/maintenance.ts).
 */
export async function createDemoAccount(
  meta: ReturnType<typeof requestMeta>,
  input: z.infer<typeof demoInput>,
) {
  const hasFreeSlot = async () =>
    (await database.$count(users, eq(users.isDemo, true))) < DEMO_MAX_ACCOUNTS
  const isDemoFull = !(await hasFreeSlot())
  if (isDemoFull) {
    await runMaintenance()
    const isStillFull = !(await hasFreeSlot())
    if (isStillFull) throw new ApiError('demo.unavailable', 503)
  }
  const id = randomUUID().replace(/-/g, '').slice(0, 10)
  const session = await database.transaction(async (transaction) => {
    const user = await createAccount(transaction, {
      username: `demo-${id}`,
      email: `demo-${id}@demo.invalid`,
      displayName: input.locale === 'pl' ? 'Konto demo' : 'Demo account',
      passwordHash: null,
      locale: input.locale,
      timezone: input.timezone ?? 'UTC',
      withSamples: true,
      demo: true,
    })
    return openSession(transaction, user, meta)
  })
  return session
}

export async function loginWithPassword(
  meta: ReturnType<typeof requestMeta>,
  input: z.infer<typeof loginInput>,
) {
  const user = await findUserByLogin(database, input.login)
  if (!user?.passwordHash) {
    await burnPasswordCheck(input.password)
    throw new ApiError('auth.invalid_credentials', 401)
  }
  const isLockedOut =
    user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()
  if (isLockedOut) throw new ApiError('auth.too_many_attempts', 429)
  const isWrongPassword = !(await verifyPassword(
    input.password,
    user.passwordHash,
  ))
  if (isWrongPassword) {
    const failed = user.failedLoginCount + 1
    await database
      .update(users)
      .set(
        failed >= MAX_FAILED_LOGINS
          ? {
              failedLoginCount: 0,
              lockoutUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
            }
          : { failedLoginCount: failed },
      )
      .where(eq(users.id, user.id))
    throw new ApiError('auth.invalid_credentials', 401)
  }
  resetRateLimit(`login:${lower(input.login)}`)
  // Dopiero po poprawnym haśle: odpowiedź nie zdradza obcym, że konto istnieje i jest zablokowane.
  if (user.disabledAt) throw new ApiError('auth.account_disabled', 403)
  // 2FA: hasło się zgadza, ale sesja dopiero po kodzie z aplikacji (bilet ważny 5 min).
  if (user.totpEnabledAt) {
    await database
      .update(users)
      .set({ failedLoginCount: 0, lockoutUntil: null })
      .where(eq(users.id, user.id))
    return {
      mfaRequired: true,
      mfaToken: await signMfaToken(user.id),
    }
  }
  const session = await database.transaction(async (transaction) => {
    const [fresh] = await transaction
      .update(users)
      .set({
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()
    return openSession(transaction, fresh!, meta)
  })
  return session
}

/** Drugi krok logowania: bilet z pierwszego kroku + kod z aplikacji albo kod zapasowy. */
export async function loginWithSecondFactor(
  meta: ReturnType<typeof requestMeta>,
  input: z.infer<typeof mfaLoginInput>,
) {
  const userId = await verifyMfaToken(input.mfaToken)
  if (!userId) throw new ApiError('auth.mfa_expired', 401)
  rateLimit(`mfa:${userId}`, 8, 15 * 60_000)
  const session = await database.transaction(async (transaction) => {
    const [user] = await transaction
      .select()
      .from(users)
      .where(eq(users.id, userId))
    if (!user?.totpEnabledAt) throw new ApiError('auth.mfa_expired', 401)
    if (user.disabledAt) throw new ApiError('auth.account_disabled', 403)
    const isWrongSecondFactor = !(await useSecondFactor(
      transaction,
      user,
      input.code,
    ))
    if (isWrongSecondFactor)
      throw new ApiError('auth.invalid_code', 400, 'code')
    const [fresh] = await transaction
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .returning()
    return openSession(transaction, fresh!, meta)
  })
  resetRateLimit(`mfa:${userId}`)
  return session
}

/** Link z e-maila: potwierdzenie adresu po rejestracji albo nowego adresu po zmianie. */
export async function confirmEmail(token: z.infer<typeof tokenInput>['token']) {
  const result = await database.transaction(async (transaction) => {
    const [row] = await transaction
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          inArray(authTokens.purpose, ['email_verification', 'email_change']),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning()
    if (!row) return null
    const [user] = await transaction
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
    if (!user) return null
    const isEmailVerification = row.purpose === 'email_verification'
    if (isEmailVerification) {
      // Link do starego adresu po zmianie e-maila nie potwierdza nowego.
      await transaction
        .update(users)
        .set({ emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
        .where(eq(users.id, user.id))
      return { kind: 'verified' as const, user, oldEmail: null }
    }
    const newEmail = row.newEmail!
    const [taken] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, lower(newEmail)),
          ne(users.id, user.id),
        ),
      )
    if (taken) throw conflict('auth.email_taken', 'email')
    await transaction
      .update(users)
      .set({ email: newEmail, emailVerifiedAt: new Date() })
      .where(eq(users.id, user.id))
    return { kind: 'changed' as const, user, oldEmail: user.email }
  })
  if (!result) throw new ApiError('auth.email_link_invalid', 400, 'token')
  if (result.oldEmail) {
    const email = (
      await database.select().from(users).where(eq(users.id, result.user.id))
    )[0]!.email
    await notify(result.user, 'emailChanged', { email }, result.oldEmail)
  }
  return { kind: result.kind }
}

export async function requestPasswordReset(
  email: z.infer<typeof emailInput>['email'],
  locale: 'en' | 'pl',
) {
  const user = await findUserByLogin(database, email)
  // Zawsze 204: odpowiedź nie zdradza, czy konto z tym adresem istnieje.
  const isSameEmail = user && lower(user.email) === lower(email)
  if (isSameEmail) {
    const token = randomToken()
    await database.insert(authTokens).values({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
    })
    await sendEmail(
      passwordResetEmail(
        locale,
        user.email,
        user.displayName,
        `${serverEnv.appUrl}/reset-password?token=${token}`,
      ),
    )
  }
  return
}

export async function resetPassword(input: z.infer<typeof resetInput>) {
  const passwordHash = await hashPassword(input.password)
  const done = await database.transaction(async (transaction) => {
    const [row] = await transaction
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, sha256(input.token)),
          eq(authTokens.purpose, 'password_reset'),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning()
    if (!row) return false
    const [owner] = await transaction
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockoutUntil: null,
        // Link przyszedł na ten adres, więc adres jest potwierdzony.
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
      })
      .where(eq(users.id, row.userId))
      .returning()
    // Nowe hasło = wylogowanie ze wszystkich urządzeń.
    await transaction
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, row.userId),
          isNull(refreshTokens.revokedAt),
        ),
      )
    return owner ?? true
  })
  if (!done) throw new ApiError('auth.reset_invalid', 400, 'token')
  const hasUserToNotify = typeof done === 'object'
  if (hasUserToNotify) await notify(done, 'passwordChanged')
  return
}

/** Wylogowanie: odwołanie refresh tokenu tego urządzenia. */
export async function endSession(token: string) {
  await revokeToken(database, token)
}
