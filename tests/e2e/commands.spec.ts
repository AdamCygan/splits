import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('command palette', () => {
  test('Ctrl+K finds a task and a settings page', async ({ page }) => {
    await signInWithSamples(page)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: 'Search and commands' })
    await expect(palette).toBeVisible()
    const input = palette.getByRole('combobox')
    await expect(input).toBeFocused()
    await expect(
      palette.getByRole('group', { name: 'Recent tasks' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    await input.fill('pay-142')
    await expect(
      palette.getByRole('option', { name: /PAY-142 Payment gateway/ }),
    ).toHaveAttribute('aria-selected', 'true')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app\/task\?/)
    await expect(palette).toBeHidden()

    await page.keyboard.press('Control+k')
    await input.fill('work types')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app\/settings\/work-types/)
  })

  test('opens from the search button and switches the theme', async ({
    page,
  }) => {
    await signInWithSamples(page)
    const open = page
      .getByRole('button', { name: /^Search/ })
      .locator('visible=true')
    if ((await open.count()) === 0) {
      await page
        .getByRole('button', { name: /^Account menu/ })
        .locator('visible=true')
        .click()
      await page.getByRole('menuitem', { name: /Search and commands/ }).click()
    } else {
      await open.click()
    }
    const palette = page.getByRole('dialog', { name: 'Search and commands' })
    await palette.getByRole('combobox').fill('dark')
    await palette.getByRole('option', { name: 'Theme: Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
