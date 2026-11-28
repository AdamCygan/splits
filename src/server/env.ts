/**
 * Konfiguracja serwera ze zmiennych środowiskowych (tylko po stronie serwera, nigdy w bundlu przeglądarki).
 * W produkcji brak DATABASE_URL albo JWT_SECRET zatrzymuje start z czytelnym błędem.
 */
import { existsSync } from 'node:fs'

// Lokalnie (pnpm dev) zmienne serwera czytamy z .env; istniejące zmienne środowiska mają pierwszeństwo.
if (process.env.NODE_ENV !== 'production' && existsSync('.env'))
  process.loadEnvFile('.env')

const env = process.env
const isProduction = env.NODE_ENV === 'production'

function required(name: string, devFallback: string): string {
  const value = env[name]
  if (value) return value
  if (isProduction) throw new Error(`Brak zmiennej środowiskowej ${name}.`)
  return devFallback
}

const databaseUrl = required(
  'DATABASE_URL',
  'postgresql://postgres@localhost:5432/splits',
)

const jwtSecret = required(
  'JWT_SECRET',
  'dev-only-secret-change-me-0123456789abcdef',
)
if (isProduction && jwtSecret.length < 32)
  throw new Error('JWT_SECRET musi mieć co najmniej 32 znaki.')

export const serverEnv = {
  isProduction,
  databaseUrl,
  /** Migracje przez bezpośrednie połączenie, gdy DATABASE_URL idzie przez pooler (np. PgBouncer). */
  migrationUrl: env.DATABASE_URL_UNPOOLED ?? databaseUrl,
  databasePoolSize: Number(env.DATABASE_POOL_SIZE ?? 10),
  migrateOnStart: env.MIGRATE_ON_START !== 'false',
  migrationsDir: env.MIGRATIONS_DIR ?? 'drizzle',
  jwtSecret,
  /** Publiczny adres aplikacji (linki w e-mailach, powrót z Google). */
  appUrl: (env.APP_URL ?? env.VITE_APP_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  ),
  google:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : null,
  resendApiKey: env.RESEND_API_KEY ?? null,
  /** Płatności Stripe; bez STRIPE_SECRET_KEY przyciski zakupu są wyłączone. */
  stripe: env.STRIPE_SECRET_KEY
    ? {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
        /** Stripe Tax: VAT liczony z adresu klienta (wymaga konfiguracji w panelu Stripe). */
        automaticTax: env.STRIPE_AUTOMATIC_TAX === 'true',
        /** Opcjonalnie id cen Pro zamiast wyszukiwania po lookup key. */
        priceProMonthly: env.STRIPE_PRICE_PRO_MONTHLY || null,
        priceProYearly: env.STRIPE_PRICE_PRO_YEARLY || null,
      }
    : null,
  /** Sentry (np. https://klucz@o1.ingest.de.sentry.io/123); bez niego błędy są tylko w logach. */
  sentryDsn: env.SENTRY_DSN ?? null,
  /** Wersja aplikacji w zgłoszeniach błędów (Railway ustawia RAILWAY_GIT_COMMIT_SHA przy każdym deployu). */
  release: env.APP_RELEASE ?? env.RAILWAY_GIT_COMMIT_SHA ?? null,
  emailFrom: env.EMAIL_FROM ?? 'Timeblame <no-reply@timeblame.com>',
  /**
   * Właściciele aplikacji (ADMIN_EMAILS, po przecinku): konto z takim potwierdzonym adresem
   * dostaje rolę admina przy logowaniu, a inni administratorzy nie mogą go zablokować ani usunąć.
   */
  adminEmails: new Set(
    (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
  /**
   * Panel admina tylko z logowaniem dwuetapowym (ADMIN_REQUIRE_2FA=true). Włącz, gdy
   * administratorzy mają już 2FA: bez niego API admina odpowiada 403 admin.two_factor_required.
   */
  adminRequire2fa: env.ADMIN_REQUIRE_2FA === 'true',
  /**
   * Nagłówek z adresem IP klienta ustawiany przez proxy hostingu (limity prób, lista sesji).
   * Railway nadpisuje X-Real-IP (inny hosting: np. Cloudflare CF-Connecting-IP). Czytamy tylko ten jeden nagłówek:
   * inne klient może podać sam i obejść limity prób.
   */
  clientIpHeader: (env.CLIENT_IP_HEADER ?? 'x-real-ip').trim().toLowerCase(),
  /** Limity prób logowania/rejestracji w pamięci; RATE_LIMITS=off tylko w testach. */
  rateLimits: env.RATE_LIMITS !== 'off' || isProduction,
  /** Tylko testy e2e: endpoint z danymi przykładowymi. Nigdy w produkcji. */
  testRoutes:
    env.ENABLE_TEST_ROUTES === '1' &&
    (!isProduction || /^http:\/\/localhost[:/]/.test(env.APP_URL ?? '')),
} as const
