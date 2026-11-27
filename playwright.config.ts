import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3100)
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres@localhost:5432/splits_e2e'

/**
 * E2E + dostępność (axe) na buildzie produkcyjnym z prawdziwym API i Postgresem.
 * Baza E2E_DATABASE_URL jest czyszczona przed startem serwera (tests/e2e/reset-db.mjs):
 *   pnpm build && pnpm test:e2e
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // W CI jedna powtórka na wolniejszej maszynie; taki test raport i tak pokazuje jako „flaky”.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // Zgoda na cookies już wybrana, żeby baner nie zasłaniał elementów; sam baner testuje legal.spec.ts.
    storageState: 'tests/e2e/consent-state.json',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node tests/e2e/reset-db.mjs && node .output/server/index.mjs',
    url: `http://localhost:${port}/api/v1/health`,
    reuseExistingServer: true,
    env: {
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'e2e-secret-0123456789abcdef0123456789',
      APP_URL: `http://localhost:${port}`,
      ENABLE_TEST_ROUTES: '1',
      RATE_LIMITS: 'off',
    },
  },
})
