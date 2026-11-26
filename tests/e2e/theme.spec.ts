import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('dark theme', () => {
  test('switches from the account menu and keeps contrast on every screen', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await page
      .getByRole('button', { name: /^Account menu/ })
      .locator('visible=true')
      .click()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expectNoA11yViolations(page)

    // Wybór zostaje po odświeżeniu, bez mignięcia jasnym motywem.
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    for (const path of [
      '/app/tasks',
      '/app/analytics',
      '/app/sprints',
      '/app/settings/work-types',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoA11yViolations(page)
    }

    // Strona główna zostaje jasna.
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
