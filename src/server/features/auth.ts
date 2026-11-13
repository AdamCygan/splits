import { createHash, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AuthSession } from '#/data/types'
import { USERNAME_RE } from '#/domain/rules'
import { isLocale } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import {
  burnPasswordCheck,
  hashPassword,
  verifyPassword,
} from '../auth/passwords'
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_DAYS,
  issueRefreshToken,
  randomToken,
  revokeToken,
  rotateRefreshToken,
  sha256,
  signAccessToken,
} from '../auth/tokens'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import { authTokens, externalLogins, refreshTokens, users } from '../db/schema'
import { passwordResetEmail, sendEmail } from '../email'
import { serverEnv } from '../env'
import type { AppEnv } from '../http/context'
import { ApiError, conflict } from '../http/errors'
import {
  body,
  demoInput,
  emailInput,
  loginInput,
  registerInput,
  resetInput,
  timezone as timezoneSchema,
} from '../http/inputs'
import { rateLimit, resetRateLimit } from '../http/rate-limit'
import { runMaintenance } from '../maintenance'
import { toUser } from './dto'
import { createWorkspace } from './workspace'

const MAX_FAILED_LOGINS = 10
const LOCKOUT_MINUTES = 15
const RESET_TOKEN_MINUTES = 60
/** Górny limit żywych kont demo: chroni bazę przed zalaniem. */
const DEMO_MAX_ACCOUNTS = 500
const secure = serverEnv.appUrl.startsWith('https://')

export function requestMeta(c: Context) {
  const forwarded =
    c.req.header('fly-client-ip') ?? c.req.header('x-forwarded-for')
  return {
    ip: forwarded?.split(',')[0]?.trim() ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }
}

const lower = (value: string) => value.trim().toLowerCase()

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
async function promoteOwner(tx: Tx, user: typeof users.$inferSelect) {
  if (user.role === 'admin' || !isOwner(user)) return user
  const [promoted] = await tx
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.id, user.id))
    .returning()
  return promoted ?? user
}

export async function sessionFor(
  c: Context,
  tx: Tx,
  account: typeof users.$inferSelect,
): Promise<AuthSession> {
  const user = await promoteOwner(tx, account)
  const refresh = await issueRefreshToken(tx, user.id, requestMeta(c))
  setRefreshCookie(c, refresh)
  const access = await signAccessToken(user.id)
  return {
    accessToken: access.token,
    expiresAt: access.expiresAt.toISOString(),
    user: toUser(user),
  }
}

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_DAYS * 86_400,
  })
}

export function clearRefreshCookie(c: Context) {
  deleteCookie(c, REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH, secure })
}

export async function findUserByLogin(tx: Tx, login: string) {
  const key = lower(login)
  const [user] = await tx
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

async function assertAvailable(tx: Tx, username: string, email: string) {
  const [byName] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, lower(username)))
  if (byName) throw conflict('auth.username_taken', 'username')
  const [byEmail] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, lower(email)))
  if (byEmail) throw conflict('auth.email_taken', 'email')
}

/** Tworzy konto z danymi startowymi; używane przez rejestrację, Google i testy e2e. */
export async function createAccount(
  tx: Tx,
  input: {
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
  },
) {
  const [user] = await tx
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
  await createWorkspace(
    tx,
    user!.id,
    input.locale,
    input.timezone,
    input.withSamples,
  )
  return user!
}

// ---------------------------------------------------------------------------
// Google (OAuth 2.0 + OpenID Connect, kod autoryzacyjny z PKCE)
// ---------------------------------------------------------------------------

const GOOGLE_COOKIE_PATH = '/api/v1/auth/google'
const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)
const googleCallback = () => `${serverEnv.appUrl}/api/v1/auth/google/callback`

/** Tylko ścieżki w obrębie aplikacji (bez „//host”), żeby nikt nie zrobił z nas przekierowania na obcą stronę. */
export const safeRedirect = (value: string | undefined) =>
  value && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : '/app'

async function uniqueUsername(tx: Tx, email: string) {
  const base =
    email
      .split('@')[0]!
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/^[^A-Za-z0-9]+/, '')
      .slice(0, 24) || 'user'
  const stem = base.length >= 3 ? base : `${base}user`
  for (let i = 0; i < 20; i++) {
    const candidate =
      i === 0 ? stem : `${stem}${Math.floor(Math.random() * 9000) + 1000}`
    if (!USERNAME_RE.test(candidate)) continue
    const [taken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.username})`, candidate.toLowerCase()))
    if (!taken) return candidate
  }
  return `user${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export const authRoutes = new Hono<AppEnv>()
  .get('/providers', (c) => c.json({ google: serverEnv.google !== null }))

  .post('/register', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`register:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(c, registerInput)
    const passwordHash = await hashPassword(input.password)
    const session = await db.transaction(async (tx) => {
      await assertAvailable(tx, input.username, input.email)
      const user = await createAccount(tx, {
        username: input.username,
        email: input.email,
        displayName: input.username,
        passwordHash,
        locale: input.locale,
        timezone: input.timezone ?? 'UTC',
      })
      return sessionFor(c, tx, user)
    })
    return c.json(session, 201)
  })

  /**
   * Konto demo bez rejestracji: jednorazowe konto z przykładowymi danymi i planem Pro.
   * Nie ma hasła ani prawdziwego adresu, nie może kupować ani zmieniać danych konta,
   * a po 24 h jest usuwane (src/server/maintenance.ts).
   */
  .post('/demo', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`demo:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(c, demoInput)
    const live = async () =>
      (await db.$count(users, eq(users.isDemo, true))) < DEMO_MAX_ACCOUNTS
    if (!(await live())) {
      await runMaintenance()
      if (!(await live())) throw new ApiError('demo.unavailable', 503)
    }
    const id = randomUUID().replace(/-/g, '').slice(0, 10)
    const session = await db.transaction(async (tx) => {
      const user = await createAccount(tx, {
        username: `demo-${id}`,
        email: `demo-${id}@demo.invalid`,
        displayName: input.locale === 'pl' ? 'Konto demo' : 'Demo account',
        passwordHash: null,
        locale: input.locale,
        timezone: input.timezone ?? 'UTC',
        withSamples: true,
        demo: true,
      })
      return sessionFor(c, tx, user)
    })
    return c.json(session, 201)
  })

  .post('/login', async (c) => {
    const meta = requestMeta(c)
    const input = await body(c, loginInput)
    rateLimit(`login-ip:${meta.ip}`, 30, 15 * 60_000)
    rateLimit(`login:${lower(input.login)}`, 15, 15 * 60_000)
    const user = await findUserByLogin(db, input.login)
    if (!user?.passwordHash) {
      await burnPasswordCheck(input.password)
      throw new ApiError('auth.invalid_credentials', 401)
    }
    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now())
      throw new ApiError('auth.too_many_attempts', 429)
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      const failed = user.failedLoginCount + 1
      await db
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
    const session = await db.transaction(async (tx) => {
      const [fresh] = await tx
        .update(users)
        .set({
          failedLoginCount: 0,
          lockoutUntil: null,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning()
      return sessionFor(c, tx, fresh!)
    })
    return c.json(session)
  })

  .post('/refresh', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE)
    if (!token) throw new ApiError('auth.no_session', 401)
    const session = await db.transaction(async (tx) => {
      const rotated = await rotateRefreshToken(tx, token, requestMeta(c))
      if (!rotated.ok) return null
      const [found] = await tx
        .select()
        .from(users)
        .where(eq(users.id, rotated.userId))
      if (!found || found.disabledAt) return null
      const user = await promoteOwner(tx, found)
      setRefreshCookie(c, rotated.token)
      const access = await signAccessToken(user.id)
      return {
        accessToken: access.token,
        expiresAt: access.expiresAt.toISOString(),
        user: toUser(user),
      } satisfies AuthSession
    })
    if (!session) {
      clearRefreshCookie(c)
      throw new ApiError('auth.no_session', 401)
    }
    return c.json(session)
  })

  .post('/logout', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE)
    if (token) await revokeToken(db, token)
    clearRefreshCookie(c)
    return c.body(null, 204)
  })

  .post('/forgot-password', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`forgot:${meta.ip}`, 10, 60 * 60_000)
    const { email } = await body(c, emailInput)
    rateLimit(`forgot:${lower(email)}`, 3, 60 * 60_000)
    const user = await findUserByLogin(db, email)
    // Zawsze 204: odpowiedź nie zdradza, czy konto z tym adresem istnieje.
    if (user && lower(user.email) === lower(email)) {
      const token = randomToken()
      await db.insert(authTokens).values({
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
      })
      const locale = c.get('locale')
      await sendEmail(
        passwordResetEmail(
          locale,
          user.email,
          user.displayName,
          `${serverEnv.appUrl}/reset-password?token=${token}`,
        ),
      )
    }
    return c.body(null, 204)
  })

  .post('/reset-password', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`reset:${meta.ip}`, 20, 60 * 60_000)
    const input = await body(c, resetInput)
    const passwordHash = await hashPassword(input.password)
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
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
      await tx
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
      // Nowe hasło = wylogowanie ze wszystkich urządzeń.
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, row.userId),
            isNull(refreshTokens.revokedAt),
          ),
        )
      return true
    })
    if (!done) throw new ApiError('auth.reset_invalid', 400, 'token')
    return c.body(null, 204)
  })

  .get('/google', (c) => {
    const google = serverEnv.google
    const redirectTo = safeRedirect(c.req.query('redirect'))
    if (!google) return c.redirect('/login?error=google_unavailable')
    const state = randomToken()
    const verifier = randomToken()
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const tz = timezoneSchema.safeParse(c.req.query('tz'))
    const cookie = {
      httpOnly: true,
      secure,
      sameSite: 'Lax' as const,
      path: GOOGLE_COOKIE_PATH,
      maxAge: 600,
    }
    setCookie(c, 'g_state', state, cookie)
    setCookie(c, 'g_verifier', verifier, cookie)
    setCookie(c, 'g_redirect', redirectTo, cookie)
    setCookie(c, 'g_tz', tz.success ? tz.data : 'UTC', cookie)
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: googleCallback(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString()
    return c.redirect(url.toString())
  })

  .get('/google/callback', async (c) => {
    const google = serverEnv.google
    const fail = () => c.redirect('/login?error=google')
    const state = getCookie(c, 'g_state')
    const verifier = getCookie(c, 'g_verifier')
    const redirectTo = safeRedirect(getCookie(c, 'g_redirect'))
    const tz = getCookie(c, 'g_tz') ?? 'UTC'
    for (const name of ['g_state', 'g_verifier', 'g_redirect', 'g_tz'])
      deleteCookie(c, name, { path: GOOGLE_COOKIE_PATH, secure })
    const code = c.req.query('code')
    if (
      !google ||
      !code ||
      !state ||
      !verifier ||
      c.req.query('state') !== state
    )
      return fail()

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: googleCallback(),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    }).catch(() => null)
    if (!tokenResponse?.ok) return fail()
    const { id_token: idToken } = (await tokenResponse.json()) as {
      id_token?: string
    }
    if (!idToken) return fail()

    let claims: {
      sub: string
      email?: string
      email_verified?: boolean
      name?: string
    }
    try {
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: google.clientId,
      })
      claims = payload as typeof claims
    } catch {
      return fail()
    }
    if (!claims.email || claims.email_verified !== true) return fail()
    const email = claims.email
    const localeCookie = getCookie(c, 'app_locale')
    const locale: Locale = isLocale(localeCookie)
      ? localeCookie
      : c.get('locale')

    const outcome = { blocked: false }
    await db.transaction(async (tx) => {
      const [link] = await tx
        .select({ userId: externalLogins.userId })
        .from(externalLogins)
        .where(
          and(
            eq(externalLogins.provider, 'google'),
            eq(externalLogins.providerUserId, claims.sub),
          ),
        )
      let user = link
        ? (await tx.select().from(users).where(eq(users.id, link.userId)))[0]
        : undefined
      if (!user) {
        // Konto z tym samym (zweryfikowanym przez Google) adresem dostaje powiązanie z Google.
        user = (
          await tx
            .select()
            .from(users)
            .where(eq(sql`lower(${users.email})`, lower(email)))
        )[0]
        user ??= await createAccount(tx, {
          username: await uniqueUsername(tx, email),
          email,
          displayName: claims.name?.trim() || email.split('@')[0]!,
          passwordHash: null,
          locale,
          timezone: timezoneSchema.safeParse(tz).success ? tz : 'UTC',
          emailVerified: true,
        })
        await tx
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
      const [fresh] = await tx
        .update(users)
        .set({
          lastLoginAt: new Date(),
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        })
        .where(eq(users.id, user.id))
        .returning()
      await sessionFor(c, tx, fresh!)
    })
    if (outcome.blocked) return c.redirect('/login?error=disabled')
    return c.redirect(redirectTo)
  })
