import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = { '#': fileURLToPath(new URL('./src', import.meta.url)) }

/**
 * Dwa zestawy testów:
 *  - unit: czyste funkcje domenowe (bez bazy),
 *  - api: API na prawdziwym Postgresie (baza z TEST_DATABASE_URL, czyszczona przed startem).
 */
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/api/global-setup.ts'],
          fileParallelism: false,
          env: {
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              'postgresql://postgres@localhost:5432/splits_test',
            JWT_SECRET: 'test-secret-0123456789abcdef0123456789',
            APP_URL: 'http://localhost:3000',
            ENABLE_TEST_ROUTES: '1',
            RATE_LIMITS: 'off',
            // Płatności w testach: fałszywy klient Stripe (tests/api/billing.test.ts), prawdziwe podpisy webhooków.
            STRIPE_SECRET_KEY: 'sk_test_fake',
            STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
          },
        },
      },
      {
        // Tylko `pnpm check:launch` (poza `pnpm test`): czy dane firmy i domena są gotowe do startu.
        resolve: { alias },
        test: {
          name: 'launch',
          include: ['tests/launch/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
