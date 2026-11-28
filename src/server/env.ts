/**
 * Konfiguracja serwera ze zmiennych środowiskowych (tylko po stronie serwera, nigdy w bundlu przeglądarki).
 * W produkcji brak DATABASE_URL albo JWT_SECRET zatrzymuje start z czytelnym błędem.
 */
import { existsSync } from 'node:fs'

// Lokalnie (pnpm dev) zmienne serwera czytamy z .env; istniejące zmienne środowiska mają pierwszeństwo.
const loadsDotEnv = process.env.NODE_ENV !== 'production' && existsSync('.env')
if (loadsDotEnv) process.loadEnvFile('.env')

const environment = process.env
const isProduction = environment.NODE_ENV === 'production'

function required(name: string, devFallback: string): string {
  const value = environment[name]
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
const isWeakSecret = isProduction && jwtSecret.length < 32
if (isWeakSecret) throw new Error('JWT_SECRET musi mieć co najmniej 32 znaki.')

export const serverEnv = {
  isProduction,
  databaseUrl,
  /** Migracje przez bezpośrednie połączenie, gdy DATABASE_URL idzie przez pooler (np. PgBouncer). */
  migrationUrl: environment.DATABASE_URL_UNPOOLED ?? databaseUrl,
  databasePoolSize: Number(environment.DATABASE_POOL_SIZE ?? 10),
  migrateOnStart: environment.MIGRATE_ON_START !== 'false',
  migrationsDir: environment.MIGRATIONS_DIR ?? 'drizzle',
  jwtSecret,
  /** Publiczny adres aplikacji (linki w e-mailach, powrót z Google). */
  appUrl: (
    environment.APP_URL ??
    environment.VITE_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, ''),
  google:
    environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET
      ? {
          clientId: environment.GOOGLE_CLIENT_ID,
          clientSecret: environment.GOOGLE_CLIENT_SECRET,
        }
      : null,
  resendApiKey: environment.RESEND_API_KEY ?? null,
  /** Płatności Stripe; bez STRIPE_SECRET_KEY przyciski zakupu są wyłączone. */
  stripe: environment.STRIPE_SECRET_KEY
    ? {
        secretKey: environment.STRIPE_SECRET_KEY,
        webhookSecret: environment.STRIPE_WEBHOOK_SECRET ?? null,
        /** Stripe Tax: VAT liczony z adresu klienta (wymaga konfiguracji w panelu Stripe). */
        automaticTax: environment.STRIPE_AUTOMATIC_TAX === 'true',
        /** Opcjonalnie id cen Pro zamiast wyszukiwania po lookup key. */
        priceProMonthly: environment.STRIPE_PRICE_PRO_MONTHLY || null,
        priceProYearly: environment.STRIPE_PRICE_PRO_YEARLY || null,
      }
    : null,
  /** Sentry (np. https://klucz@o1.ingest.de.sentry.io/123); bez niego błędy są tylko w logach. */
  sentryDsn: environment.SENTRY_DSN ?? null,
  /** Wersja aplikacji w zgłoszeniach błędów (Railway ustawia RAILWAY_GIT_COMMIT_SHA przy każdym deployu). */
  release:
    environment.APP_RELEASE ?? environment.RAILWAY_GIT_COMMIT_SHA ?? null,
  emailFrom: environment.EMAIL_FROM ?? 'Timeblame <no-reply@timeblame.com>',
  /**
   * Właściciele aplikacji (ADMIN_EMAILS, po przecinku): konto z takim potwierdzonym adresem
   * dostaje rolę admina przy logowaniu, a inni administratorzy nie mogą go zablokować ani usunąć.
   */
  adminEmails: new Set(
    (environment.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
  /**
   * Panel admina tylko z logowaniem dwuetapowym (ADMIN_REQUIRE_2FA=true). Włącz, gdy
   * administratorzy mają już 2FA: bez niego API admina odpowiada 403 admin.two_factor_required.
   */
  adminRequire2fa: environment.ADMIN_REQUIRE_2FA === 'true',
  /**
   * Nagłówek z adresem IP klienta ustawiany przez proxy hostingu (limity prób, lista sesji).
   * Railway nadpisuje X-Real-IP (inny hosting: np. Cloudflare CF-Connecting-IP). Czytamy tylko ten jeden nagłówek:
   * inne klient może podać sam i obejść limity prób.
   */
  clientIpHeader: (environment.CLIENT_IP_HEADER ?? 'x-real-ip')
    .trim()
    .toLowerCase(),
  /** Limity prób logowania/rejestracji w pamięci; RATE_LIMITS=off tylko w testach. */
  rateLimits: environment.RATE_LIMITS !== 'off' || isProduction,
  /** Tylko testy e2e: endpoint z danymi przykładowymi. Nigdy w produkcji. */
  testRoutes:
    environment.ENABLE_TEST_ROUTES === '1' &&
    (!isProduction ||
      /^http:\/\/localhost[:/]/.test(environment.APP_URL ?? '')),
} as const
