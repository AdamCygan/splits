import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('progress, quick delete, sprint tasks and charts', () => {
  test.beforeEach(async ({ page }) => signInWithSamples(page))

  test('Today shows the story points earned by the time worked', async ({
    page,
  }) => {
    await page.goto('/app')
    const task = page
      .getByRole('region', { name: 'Today’s entries' })
      .getByRole('listitem')
      .filter({ hasText: 'PAY-142 Payment gateway integration' })
      .first()
    // 3 SP, estymata 5h, przepracowane 5h 55m we wszystkich dniach.
    await expect(
      task.getByText('≈ 3 of 3 SP done (5h 55m of 5h)'),
    ).toBeVisible()
    await expect(task.getByText(/55m over budget/)).toBeVisible()
    await expect(
      task.getByRole('progressbar', { name: 'Story points done so far' }),
    ).toBeVisible()
  })

  test('deletes a whole task from the day after a warning', async ({
    page,
  }) => {
    await page.goto('/app')
    await page
      .getByRole('button', {
        name: 'Delete PAY-142 Payment gateway integration from this day',
      })
      .click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(
      'Delete “PAY-142 Payment gateway integration” from this day?',
    )
    await expect(dialog).toContainText('This can’t be undone.')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('Deleted “PAY-142 Payment gateway integration”'),
    ).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Today’s entries' })
        .getByText('PAY-142 Payment gateway integration'),
    ).toHaveCount(0)
  })

  test('lists the tasks of a sprint', async ({ page }) => {
    await page.goto('/app/sprints')
    await page.getByRole('link', { name: 'Sprint tasks' }).click()
    await expect(page).toHaveURL(/\/app\/tasks\?sprint=/)
    await expect(page.getByLabel('Period or sprint')).toHaveValue(/^sprint:/)
    await expect(page.getByText(/^Sprint \d+: /)).toBeVisible()
    await expect(
      page
        .getByRole('link', { name: 'PAY-142 Payment gateway integration' })
        .first(),
    ).toBeVisible()

    await page.getByLabel('Period or sprint').selectOption('d30')
    await expect(page).not.toHaveURL(/sprint=/)
  })

  test('deletes a whole task from the Tasks page', async ({ page }) => {
    await page.goto('/app/tasks')
    await page
      .getByRole('button', {
        name: 'Delete the whole task PAY-139 Refund API endpoint',
      })
      .click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('All 2 sessions from every day')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('Deleted “PAY-139 Refund API endpoint”'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'PAY-139 Refund API endpoint' }),
    ).toHaveCount(0)
  })

  test('reports show the analysis charts with a table view', async ({
    page,
  }) => {
    await page.goto('/app/analytics')
    const charts = page.getByRole('region', { name: 'Analysis' })
    await expect(
      charts.getByRole('heading', { name: 'Time day by day' }),
    ).toBeVisible()
    await expect(
      charts.getByRole('heading', { name: 'When you work' }),
    ).toBeVisible()
    await expect(
      charts.getByRole('heading', { name: 'Estimate accuracy' }),
    ).toBeVisible()
    await expect(charts.getByText('+55m')).toBeVisible()
    // Klawiatura: fokus na wykresie i strzałki czytają kolejne dni.
    await charts
      .getByRole('group', { name: /use the left and right arrow keys/ })
      .focus()
    await page.keyboard.press('Home')
    await expect(charts.locator('[aria-live="polite"]')).toHaveText(/: 0m$/)
    await charts.getByText('Show as a table').click()
    await expect(
      charts.getByRole('columnheader', { name: 'Total' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
