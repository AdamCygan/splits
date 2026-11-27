import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples, testEach } from './helpers'

test.describe('dark theme', () => {
  test('Should switch from the account menu and keep the choice after a reload', async ({
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

    // Strona główna zostaje jasna.
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  testEach([
    '/app/tasks',
    '/app/analytics',
    '/app/sprints',
    '/app/settings/work-types',
  ])('Should keep contrast on %s in the dark theme', async (path, page) => {
    await signInWithSamples(page)
    await page.evaluate(() => localStorage.setItem('ph-theme', 'dark'))
    await page.goto(path)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
