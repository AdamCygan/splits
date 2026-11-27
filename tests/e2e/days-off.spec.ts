import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('days off', () => {
  test.beforeEach(async ({ page }) => signInWithSamples(page))

  test('Should mark today as sick leave and remove it again', async ({
    page,
  }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: 'Day off', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Mark a day off' })
    await dialog.getByText('Sick leave', { exact: true }).click()
    await dialog.getByLabel(/^Note/).fill('Flu')
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Save day off' }).click()
    await expect(page.getByText('Marked 1 day off')).toBeVisible()

    const banner = page.getByRole('region', { name: 'Sick leave' })
    await expect(banner).toContainText('Sick leave: Flu')
    await expect(
      page.getByRole('button', { name: 'Day off', exact: true }),
    ).toHaveCount(0)

    await banner.getByRole('button', { name: 'Remove day off' }).click()
    await expect(page.getByText('Day off removed')).toBeVisible()
    await expect(banner).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Day off', exact: true }),
    ).toBeVisible()
  })

  test('Should plan a vacation in settings and count it in the sprint', async ({
    page,
  }) => {
    await page.goto('/app/settings/days-off')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Days off' }),
    ).toBeVisible()
    await expect(page.getByText(/No days off yet/)).toBeVisible()

    await page.getByRole('button', { name: 'Add days off' }).click()
    const dialog = page.getByRole('dialog', { name: 'Mark a day off' })
    await dialog.getByLabel('From', { exact: true }).fill('2026-12-21')
    await dialog.getByLabel('To', { exact: true }).fill('2026-12-31')
    await expect(dialog.getByText(/weekends are skipped/)).toBeVisible()
    await dialog.getByLabel(/^Note/).fill('Christmas')
    await dialog.getByRole('button', { name: 'Save day off' }).click()
    // 21–31 grudnia 2026: 9 dni roboczych (pn–pt).
    await expect(page.getByText('Marked 9 days off')).toBeVisible()
    await expect(page.getByText('Vacation: Christmas')).toBeVisible()
    await expect(page.getByText(/, 9 days$/)).toBeVisible()
    await expect(page.getByText('This year: Vacation: 9 days')).toBeVisible()
    await expectNoA11yViolations(page)

    await page.getByRole('button', { name: /^Remove Vacation, / }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Remove' })
      .click()
    await expect(page.getByText('Days off removed')).toBeVisible()
    await expect(page.getByText(/No days off yet/)).toBeVisible()
  })

  test('Should show the working days of the current sprint', async ({
    page,
  }) => {
    await page.goto('/app/sprints')
    await expect(page.getByText('Working days')).toBeVisible()
    await expect(page.getByText('No days off')).toBeVisible()
  })
})
