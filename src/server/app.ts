import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { LOCALE_COOKIE, isLocale } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { site } from '#/config/site'
import { isCutOff } from '#/features/auth/data/access.server'
import { verifyAccessToken } from '#/features/auth/data/tokens.server'
import { db, ensureMigrated } from './db/client'
import { serverEnv } from './env'
import { accountRoutes } from '#/features/account/controllers/routes.server'
import { adminRoutes } from '#/features/admin/controllers/routes.server'
import { bootstrapRoutes } from '#/features/app/controllers/routes.server'
import {
  billingRoutes,
  stripeWebhookRoutes,
} from '#/features/billing/controllers/routes.server'
import { authRoutes } from '#/features/auth/controllers/routes.server'
import { testRoutes } from './test-routes'
import { projectRoutes } from '#/features/projects/controllers/routes.server'
import { scaleRoutes } from '#/features/story-points/controllers/routes.server'
import { settingsRoutes } from '#/features/settings/controllers/routes.server'
import { statusRoutes } from '#/features/task-statuses/controllers/routes.server'
import { tagRoutes } from '#/features/tags/controllers/routes.server'
import { taskTypeRoutes } from '#/features/task-types/controllers/routes.server'
import { templateRoutes } from '#/features/templates/controllers/routes.server'
import { entryRoutes } from '#/features/time-entries/controllers/routes.server'
import { breakRoutes } from '#/features/breaks/controllers/routes.server'
import { dayOffRoutes } from '#/features/days-off/controllers/routes.server'
import { sprintRoutes } from '#/features/sprints/controllers/routes.server'
import type { AppEnv } from './http/context'
import { ApiError, fromDatabaseError, problem } from './http/errors'
import { sameOrigin } from './http/origin'
import { limitBody } from './http/body-limit'
import { startMaintenance } from './maintenance'
import { installProcessHandlers, reportError } from './monitoring'
import { launchProblems } from '#/config/launch-check'
import { feedbackRoutes } from '#/features/feedback/controllers/routes.server'
import { workspaceRoutes } from '#/features/workspaces/controllers/routes.server'
import { resolveWorkspace } from '#/features/workspaces/data/repository.server'
import { WORKSPACE_COOKIE } from '#/features/workspaces/domain/workspaces'

const VERSION = '1.0.0'

function detectLocale(
  cookie: string | undefined,
  header: string | undefined,
): Locale {
  if (isLocale(cookie)) return cookie
  return header?.toLowerCase().startsWith('pl') ? 'pl' : 'en'
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

api.use(
  '*',
  secureHeaders({
    crossOriginResourcePolicy: 'same-origin',
    // API zwraca tylko JSON: nic z odpowiedzi nie może się wykonać ani osadzić.
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: 'max-age=63072000; includeSubDomains',
  }),
)
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
api.use('*', limitBody)

api.use('/auth/*', async (c, next) => {
  const allowed = sameOrigin({
    origin: c.req.header('origin'),
    fetchSite: c.req.header('sec-fetch-site'),
    requestUrl: c.req.url,
    appUrl: serverEnv.appUrl,
  })
  if (c.req.method !== 'GET' && !allowed) throw new HTTPException(403)
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

/**
 * Bieżąca przestrzeń: z ciasteczka tej przeglądarki, jeśli należy do konta, inaczej pierwsza.
 * Każde zapytanie o dane pracy filtruje potem po niej (scopeOf).
 */
const withWorkspace: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set(
    'workspaceId',
    await resolveWorkspace(c.get('userId'), getCookie(c, WORKSPACE_COOKIE)),
  )
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
  '/feedback': feedbackRoutes,
  '/workspaces': workspaceRoutes,
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

// Tylko testy e2e (ENABLE_TEST_ROUTES=1 poza produkcją): konto z danymi, skrzynka e-maili.
if (serverEnv.testRoutes) api.route('/test', testRoutes)

for (const [path, routes] of Object.entries(protectedRoutes)) {
  api.use(path, requireAuth, withWorkspace)
  api.use(`${path}/*`, requireAuth, withWorkspace)
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
  console.error('[api] %s %s %s', traceId, c.req.method, c.req.path, error)
  await reportError(error, where)
  return c.json(problem(locale, 'server.unexpected', 500, [], traceId), 500)
})
