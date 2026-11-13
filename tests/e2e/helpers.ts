import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Loguje do nowego konta z przykładowymi danymi (endpoint testowy, ENABLE_TEST_ROUTES=1).
 * page.request dzieli ciasteczka ze stroną, więc /app odtworzy sesję z refresh tokenu.
 */
export async function signInWithSamples(
  page: Page,
  locale: 'en' | 'pl' = 'en',
) {
  const response = await page.request.post('/api/v1/test/sample-account', {
    data: {
      locale,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
  })
  expect(response.status()).toBe(201)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app/)
}

/** Zero naruszeń WCAG 2.2 A/AA wg axe. */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary).toEqual([])
}
