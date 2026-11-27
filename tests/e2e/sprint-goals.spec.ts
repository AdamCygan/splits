import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('sprints: time goals', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('Should set a time goal for code review and follow it on the sprint page', async ({
    page,
  }) => {
    await page.goto('/app/sprints')
    const current = await page
      .getByRole('heading', { level: 2 })
      .filter({ hasText: /^Sprint \d+/ })
      .first()
      .textContent()
    const name = /Sprint \d+/.exec(current ?? '')![0]

    await page.goto('/app/settings/sprints')
    await page
      .getByRole('button', { name: `Edit : ${name}`, exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Add a time goal' }).click()
    await dialog
      .getByRole('combobox', { name: 'Kind of work for goal 1' })
      .selectOption({ label: 'Code review' })
    // Bez czasu nie da się zapisać.
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(
      dialog.getByText('Enter a time, like 6h or 1h 30m.'),
    ).toBeVisible()
    await dialog
      .getByRole('textbox', { name: 'Time for Code review' })
      .fill('6h')
    await dialog.getByRole('button', { name: 'Add a time goal' }).click()
    await dialog
      .getByRole('combobox', { name: 'Kind of work for goal 2' })
      .selectOption({ label: 'Meeting' })
    await dialog
      .getByRole('textbox', { name: 'Time for Meeting' })
      .fill('1h 30m')
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText('Time goals: Code review 6h, Meeting 1h 30m'),
    ).toBeVisible()

    await page.goto('/app/sprints')
    const goals = page.getByRole('region', { name: 'Time goals' })
    await expect(
      goals.getByRole('progressbar', { name: 'Time goal for Code review' }),
    ).toBeVisible()
    await expect(goals).toContainText(/of 6h/)
    await expect(goals).toContainText(/of 1h 30m/)
    await expectNoA11yViolations(page)
  })
})
