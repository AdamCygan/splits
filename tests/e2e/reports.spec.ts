import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('reports: story points and time per task', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app/analytics')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reports' }),
    ).toBeVisible()
  })

  test('shows the current sprint with SP and time for each task', async ({
    page,
  }) => {
    await expect(page.getByLabel('Period')).toHaveValue(/^sprint:/)
    const table = page.getByRole('table')
    const refund = table
      .getByRole('row')
      .filter({ hasText: 'PAY-139 Refund API endpoint' })
    // Dwie sesje tego samego zadania: czas się sumuje, SP liczą się raz.
    await expect(
      refund.getByRole('cell', { name: '5', exact: true }),
    ).toBeVisible()
    await expect(
      refund.getByRole('cell', { name: '5h 35m', exact: true }),
    ).toBeVisible()
    await expect(
      table.getByRole('row').filter({ hasText: 'CR !477' }),
    ).toContainText('No SP')
    await expect(
      table.getByRole('row').filter({ hasText: 'Sprint planning' }),
    ).toContainText('No SP')
    await expectNoA11yViolations(page)
  })

  test('filters by kind of work and sorts by story points', async ({
    page,
  }) => {
    await page
      .getByRole('combobox', { name: 'Kind of work' })
      .selectOption({ label: 'Code review' })
    const rows = page.getByRole('table').locator('tbody tr')
    await expect(rows).toHaveCount(3)
    await page.getByRole('button', { name: /^SP/ }).click()
    await expect(
      page.getByRole('columnheader', { name: /^SP/ }),
    ).toHaveAttribute('aria-sort', 'descending')
    await expect(
      rows.first().getByRole('cell', { name: '0.5', exact: true }),
    ).toBeVisible()
    await expect(rows.last()).toContainText('CR !477')
    await expect(rows.last()).toContainText('No SP')
  })

  test('custom range validates dates', async ({ page }) => {
    await page.getByLabel('Period').selectOption('custom')
    await page.getByLabel('From').fill('2030-01-10')
    await page.getByLabel('To').fill('2030-01-01')
    await expect(
      page.getByText('Pick a start date on or before the end date'),
    ).toBeVisible()
  })
})

test.describe('story points per kind of work', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('tasks need SP, reviews have them optional, meetings have none', async ({
    page,
  }) => {
    await page.goto('/app')
    const form = page.getByRole('region', { name: 'Log time' })
    const sp = form.getByRole('group', { name: /^Story points/ })
    await expect(sp).toContainText('(required)')
    await form.getByText('Code review', { exact: true }).click()
    await expect(sp).toContainText('(optional)')
    await expect(sp.getByRole('radio', { name: 'No SP' })).toBeChecked()
    await form.getByText('Meeting', { exact: true }).click()
    await expect(sp).toBeHidden()
  })

  test('making SP required for code reviews in settings', async ({ page }) => {
    await page.goto('/app/settings/work-types')
    await page.getByRole('button', { name: /^Edit\s*: Code review$/ }).click()
    const dialog = page.getByRole('dialog')
    const group = dialog.getByRole('group', { name: 'Story points' })
    await group.getByText('Required').click()
    await expect(dialog.getByLabel('Default story points')).toHaveValue('0.5')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Code review' }),
    ).toContainText('SP required, 0.5 SP by default')

    await page.goto('/app')
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Code review', { exact: true }).click()
    await expect(
      form.getByRole('group', { name: /^Story points/ }),
    ).toContainText('(required)')
  })
})

test('tasks and sprints pages show real numbers and link to reports', async ({
  page,
}) => {
  await signInWithSamples(page)
  await page.getByRole('link', { name: 'Tasks', exact: true }).first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tasks' }),
  ).toBeVisible()
  const tasks = page.getByRole('region', { name: 'Tasks' })
  await expect(
    tasks.getByText('PAY-142 Payment gateway integration'),
  ).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('PAY-142')
  await expect(tasks.getByRole('status')).toHaveText('1 task')
  await expectNoA11yViolations(page)

  await page.getByRole('link', { name: 'Sprints', exact: true }).first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sprints' }),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expectNoA11yViolations(page)
  await page.getByRole('link', { name: 'Open report' }).click()
  await expect(page).toHaveURL(/\/app\/analytics\?sprint=/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Reports' }),
  ).toBeVisible()
})
