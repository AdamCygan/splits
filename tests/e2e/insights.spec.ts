import { expect, test } from '@playwright/test'
import {
  expectNoA11yViolations,
  openTaskFilters,
  signInWithSamples,
} from './helpers'

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
    // Na widoku krótko (czas z budżetu i przekroczenie), pełny opis w aria.
    await expect(task.getByText('5h 55m / 5h')).toBeVisible()
    await expect(task.getByText('+55m')).toBeVisible()
    const bar = task.getByRole('progressbar', {
      name: 'Story points done so far',
    })
    await expect(bar).toHaveAttribute(
      'aria-valuetext',
      '≈ 3 of 3 SP done (5h 55m of 5h) · 55m over budget · from your estimate',
    )
  })

  test('deletes a whole task from the day after a warning', async ({
    page,
  }) => {
    await page.goto('/app')
    await page
      .getByRole('button', {
        name: 'More actions: PAY-142 Payment gateway integration',
        exact: true,
      })
      .click()
    await page.getByRole('menuitem', { name: 'Delete from this day' }).click()
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
    // Nagłówek sprintu: nazwa, daty i dzień sprintu.
    await expect(
      page.locator('p').filter({ hasText: /^Sprint \d+$/ }),
    ).toBeVisible()
    await expect(page.getByText(/Day \d+ of \d+|Ended/)).toBeVisible()
    await expect(
      page
        .getByRole('link', { name: 'PAY-142 Payment gateway integration' })
        .first(),
    ).toBeVisible()

    await openTaskFilters(page)
    await page.getByLabel('Period or sprint').selectOption('d30')
    await expect(page).not.toHaveURL(/sprint=/)
  })

  test('deletes a whole task from the Tasks page', async ({ page }) => {
    await page.goto('/app/tasks')
    // Usuwanie siedzi w menu „Więcej akcji” wiersza.
    await page
      .getByRole('button', {
        name: 'More actions for PAY-139 Refund API endpoint',
      })
      .click()
    await page.getByRole('menuitem', { name: 'Delete task' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('All 2 sessions from every day')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('Deleted “PAY-139 Refund API endpoint”'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', {
        name: 'PAY-139 Refund API endpoint',
        exact: true,
      }),
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

test.describe('tasks list', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('groups a sprint’s tasks by kind of work and filters by status', async ({
    page,
  }) => {
    await page.goto('/app/sprints')
    await page
      .getByRole('link', { name: /Sprint tasks/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/app\/tasks\?sprint=/)

    const taskGroup = page.getByRole('region', { name: 'Task', exact: true })
    await expect(taskGroup).toContainText(/3 tasks/)
    await expect(
      taskGroup.getByRole('link', {
        name: 'MOB-77 Push notification settings',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole('region', { name: 'Meeting' })).toBeVisible()
    await expectNoA11yViolations(page)

    // Tylko zadania w toku: zakończony PAY-139 znika, MOB-77 zostaje.
    await openTaskFilters(page)
    await page
      .locator('label')
      .filter({ hasText: /^In progress$/ })
      .click()
    await expect(
      page.getByRole('link', {
        name: 'PAY-139 Refund API endpoint',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', {
        name: 'MOB-77 Push notification settings',
        exact: true,
      }),
    ).toBeVisible()

    // Grupowanie po dniu: nagłówki to daty.
    await page.locator('label').filter({ hasText: /^Day$/ }).click()
    await expect(
      page.getByRole('region', { name: 'Task', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 2, name: /day, / }).first(),
    ).toBeVisible()
  })
})
