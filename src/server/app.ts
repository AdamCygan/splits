import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { LOCALE_COOKIE, isLocale } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { site } from '#/config/site'
import { isCutOff } from './auth/access'
import { verifyAccessToken } from './auth/tokens'
import { db, ensureMigrated } from './db/client'
import { serverEnv } from './env'
import { accountRoutes } from './features/account'
import { adminRoutes } from './features/admin'
import { bootstrapRoutes } from './features/bootstrap'
import { billingRoutes, stripeWebhookRoutes } from './features/billing'
import { authRoutes, createAccount, sessionFor } from './features/auth'
import {
  projectRoutes,
  scaleRoutes,
  settingsRoutes,
  statusRoutes,
  tagRoutes,
  taskTypeRoutes,
  templateRoutes,
} from './features/config'
import { entryRoutes } from './features/entries'
import { breakRoutes } from './features/breaks'
import { dayOffRoutes } from './features/days-off'
import { sprintRoutes } from './features/sprints'
import type { AppEnv } from './http/context'
import { ApiError, fromDatabaseError, problem } from './http/errors'
import { startMaintenance } from './maintenance'
import { installProcessHandlers, reportError } from './monitoring'
import { launchProblems } from '#/config/launch-check'
import { body, timezone } from './http/inputs'
import { z } from 'zod'

const VERSION = '1.0.0'

function detectLocale(
  cookie: string | undefined,
  header: string | undefined,
): Locale {
  if (isLocale(cookie)) return cookie
  return header?.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

/** Ścieżki z ciasteczkiem sesji: przyjmujemy je tylko z naszej własnej strony (ochrona przed CSRF). */
function sameOrigin(origin: string | undefined, requestUrl: string) {
  if (!origin) return true
  const own = new URL(requestUrl).origin
  return origin === own || origin === new URL(serverEnv.appUrl).origin
}

/**
 * API pod /api/v1. Jeden proces z resztą aplikacji (TanStack Start), więc frontend
 * woła je pod tym samym adresem i nie potrzebuje CORS.
 */
installProcessHandlers()
// Sprzątanie bazy co godzinę (konta demo, stare tokeny). W testach uruchamiane ręcznie.
if (serverEnv.isProduction) startMaintenance()

// Produkcja z placeholderami w danych firmy: głośne ostrzeżenie w logach i w Sentry (pnpm check:launch).
if (serverEnv.isProduction) {
  const problems = launchProblems()
  if (problems.length > 0) {
    console.warn(
      `[launch] Do uzupełnienia przed startem:\n - ${problems.join('\n - ')}`,
    )
    void reportError(new Error(`Launch check: ${problems.join('; ')}`), {
      level: 'warning',
      tags: { area: 'launch-check' },
    })
  }
}

export const api = new Hono<AppEnv>().basePath('/api/v1')

api.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }))
api.use('*', async (c, next) => {
  c.set('traceId', randomUUID())
  c.set(
    'locale',
    detectLocale(getCookie(c, LOCALE_COOKIE), c.req.header('accept-language')),
  )
  c.header('Cache-Control', 'no-store')
  await ensureMigrated()
  await next()
})

api.use('/auth/*', async (c, next) => {
  if (c.req.method !== 'GET' && !sameOrigin(c.req.header('origin'), c.req.url))
    throw new HTTPException(403)
  await next()
})

/** Wymaga ważnego access tokenu (nagłówek Authorization: Bearer). */
const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  const userId = token ? await verifyAccessToken(token) : null
  // Konto zablokowane albo usunięte przed chwilą: token jeszcze ważny, ale dostęp już odcięty.
  if (!userId || isCutOff(userId)) throw new ApiError('auth.no_session', 401)
  c.set('userId', userId)
  await next()
}

const protectedRoutes = {
  '/account': accountRoutes,
  '/settings': settingsRoutes,
  '/story-point-scale': scaleRoutes,
  '/task-types': taskTypeRoutes,
  '/task-statuses': statusRoutes,
  '/sprints': sprintRoutes,
  '/days-off': dayOffRoutes,
  '/breaks': breakRoutes,
  '/projects': projectRoutes,
  '/tags': tagRoutes,
  '/time-entries': entryRoutes,
  '/quick-templates': templateRoutes,
  '/billing': billingRoutes,
  '/bootstrap': bootstrapRoutes,
  '/admin': adminRoutes,
} as const

api.get('/meta', (c) =>
  c.json({
    name: site.name,
    version: VERSION,
    environment: serverEnv.isProduction ? 'Production' : 'Development',
    serverTime: new Date().toISOString(),
  }),
)
api.get('/health', async (c) => {
  await db.execute('select 1')
  return c.json({ status: 'ok' })
})
api.route('/auth', authRoutes)
// Webhook Stripe: bez logowania, uwierzytelniony podpisem Stripe-Signature.
api.route('/stripe', stripeWebhookRoutes)

// Tylko testy e2e (ENABLE_TEST_ROUTES=1 poza produkcją): konto z przykładowymi danymi.
if (serverEnv.testRoutes) {
  api.post('/test/sample-account', async (c) => {
    const input = await body(
      c,
      z.object({
        locale: z.enum(['en', 'pl']).default('en'),
        timezone: timezone.optional(),
      }),
    )
    const id = randomUUID().slice(0, 8)
    const session = await db.transaction(async (tx) => {
      const user = await createAccount(tx, {
        username: `sample-${id}`,
        email: `sample-${id}@example.com`,
        displayName: input.locale === 'pl' ? 'Konto testowe' : 'Sample account',
        passwordHash: null,
        locale: input.locale,
        timezone: input.timezone ?? 'UTC',
        withSamples: true,
      })
      return sessionFor(c, tx, user)
    })
    return c.json(session, 201)
  })
}

for (const [path, routes] of Object.entries(protectedRoutes)) {
  api.use(path, requireAuth)
  api.use(`${path}/*`, requireAuth)
  api.route(path, routes)
}

interface LocaleContext {
  get: (key: 'locale') => Locale | undefined
}

/** Locale z middleware; przy błędzie przed middleware (np. zły nagłówek) — angielski. */
const localeOf = (c: LocaleContext) => c.get('locale') ?? 'en'

api.notFound((c) => c.json(problem(localeOf(c), 'not_found', 404), 404))

api.onError(async (error, c) => {
  const locale = localeOf(c)
  const traceId = c.get('traceId')
  const known = error instanceof ApiError ? error : fromDatabaseError(error)
  const where = {
    traceId,
    method: c.req.method,
    path: c.req.path,
    userId: c.get('userId') as string | undefined,
    tags: (c.req.path.includes('/stripe/')
      ? { area: 'stripe-webhook' }
      : {}) as Record<string, string>,
  }
  if (known) {
    // Znane błędy 5xx (np. Stripe niedostępny) też chcemy widzieć, jako ostrzeżenia.
    if (known.status >= 500)
      await reportError(error, {
        ...where,
        level: 'warning',
        tags: { ...where.tags, code: known.code },
      })
    return c.json(
      problem(
        locale,
        known.code,
        known.status,
        known.field ? [known.field] : [],
        traceId,
      ),
      known.status,
    )
  }
  if (error instanceof HTTPException) {
    return c.json(
      problem(locale, 'validation.invalid', error.status, [], traceId),
      error.status,
    )
  }
  console.error(`[api] ${traceId} ${c.req.method} ${c.req.path}`, error)
  await reportError(error, where)
  return c.json(problem(locale, 'server.unexpected', 500, [], traceId), 500)
})
