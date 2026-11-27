import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

async function openPalette(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search and commands' })
  await expect(palette).toBeVisible()
  const input = palette.getByRole('combobox')
  await expect(input).toBeFocused()
  return { palette, input }
}

test.describe('command palette', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('Should find a task by title and open it, then a settings page', async ({
    page,
  }) => {
    const { palette, input } = await openPalette(page)
    await expect(
      palette.getByRole('group', { name: 'Recent tasks' }),
    ).toBeVisible()
    await expect(
      palette.getByRole('option', { name: /^Log time/ }),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    await input.fill('pay-142')
    await expect(
      palette
        .getByRole('group', { name: 'Tasks and notes' })
        .getByRole('option', { name: /PAY-142 Payment gateway/ }),
    ).toHaveAttribute('aria-selected', 'true')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app\/task\?/)
    await expect(palette).toBeHidden()

    await page.keyboard.press('Control+k')
    await input.fill('work types')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app\/settings\/work-types/)
  })

  test('Should find a task by a word from its notes and show the snippet', async ({
    page,
  }) => {
    const { palette, input } = await openPalette(page)
    await input.fill('idempotency')
    const option = palette.getByRole('option', {
      name: /PAY-142 Payment gateway integration/,
    })
    await expect(option).toBeVisible()
    await expect(option).toContainText('idempotency key')
    await expectNoA11yViolations(page)
  })

  test('Should lead “create task” to the log form and use the typed text as the title', async ({
    page,
  }) => {
    await page.goto('/app/tasks')
    const { palette, input } = await openPalette(page)
    await input.fill('create task')
    await expect(
      palette.getByRole('option', { name: /^Log time/ }).first(),
    ).toHaveAttribute('aria-selected', 'true')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app$/)
    const form = page.getByRole('region', { name: 'Log time' })
    await expect(form.getByLabel('Title')).toBeFocused()

    await page.keyboard.press('Control+k')
    await input.fill('PAY-200 Invoice emails')
    await palette
      .getByRole('option', {
        name: 'Start a timer for “PAY-200 Invoice emails”',
      })
      .click()
    await expect(form.getByLabel('Title')).toHaveValue('PAY-200 Invoice emails')
    await expect(
      form.getByRole('button', { name: 'Start timer' }),
    ).toBeVisible()
  })

  test('Should run a quick template and open a typed day', async ({ page }) => {
    const { palette, input } = await openPalette(page)
    await input.fill('stand-up')
    await palette.getByRole('option', { name: /^Log “Daily stand-up”/ }).click()
    await expect(page.getByText(/Logged “Daily stand-up”, 15m/)).toBeVisible()

    await page.keyboard.press('Control+k')
    await input.fill('yesterday')
    await palette.getByRole('option', { name: 'Yesterday’s summary' }).click()
    await expect(page).toHaveURL(/\/app\/day\?date=/)
  })

  test('Should control the running timer and show keyboard shortcuts', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Timer$/ })
      .click()
    await form.getByLabel('Title').fill('PAY-300 Palette timer')
    await form.getByRole('button', { name: 'Start timer' }).click()
    await expect(page.getByRole('region', { name: 'Running' })).toBeVisible()

    const { palette, input } = await openPalette(page)
    await expect(
      palette.getByRole('group', { name: 'Running now' }),
    ).toBeVisible()
    await palette
      .getByRole('option', { name: 'Stop “PAY-300 Palette timer”' })
      .click()
    await expect(page.getByText(/^Timer stopped/)).toBeVisible()

    await page.keyboard.press('Control+k')
    await input.fill('shortcuts')
    await input.press('Enter')
    await expect(
      palette.getByRole('heading', { name: 'Keyboard shortcuts' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('Should open from the search button and switch the theme', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
