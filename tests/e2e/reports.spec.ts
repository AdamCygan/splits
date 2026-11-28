import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

/** Zadania raportu: wiersze tabeli na komputerze, karty na telefonie. */
const taskItems = (page: Page, isMobile: boolean) =>
  isMobile
    ? page
        .getByRole('list', { name: 'Tasks', exact: true })
        .getByRole('listitem')
    : page.getByRole('table').locator('tbody tr')

test.describe('reports: story points and time per task', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app/analytics')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reports' }),
    ).toBeVisible()
  })

  test('Should show the current sprint with SP and time for each task', async ({
    page,
    isMobile,
  }) => {
    await expect(page.getByLabel('Period')).toHaveValue(/^sprint:/)
    const tasks = taskItems(page, isMobile)
    const refund = tasks.filter({ hasText: 'PAY-139 Refund API endpoint' })
    // Dwie sesje tego samego zadania: czas się sumuje, SP liczą się raz.
    await expect(refund.getByText('5', { exact: true })).toBeVisible()
    await expect(refund.getByText('5h 35m', { exact: true })).toBeVisible()
    await expect(tasks.filter({ hasText: 'CR !477' })).toContainText('No SP')
    await expect(tasks.filter({ hasText: 'Sprint planning' })).toContainText(
      'No SP',
    )
    await expectNoA11yViolations(page)
  })

  test('Should filter by kind of work and sort by story points', async ({
    page,
    isMobile,
  }) => {
    await page
      .getByRole('combobox', { name: 'Kind of work' })
      .selectOption({ label: 'Code review' })
    const rows = taskItems(page, isMobile)
    await expect(rows).toHaveCount(3)
    if (isMobile) {
      await page
        .getByRole('combobox', { name: 'Sort by' })
        .selectOption({ label: 'SP' })
      await expect(
        page.getByRole('button', { name: /^Descending/ }),
      ).toBeVisible()
    } else {
      await page.getByRole('button', { name: /^SP/ }).click()
      await expect(
        page.getByRole('columnheader', { name: /^SP/ }),
      ).toHaveAttribute('aria-sort', 'descending')
    }
    await expect(rows.first().getByText('0.5', { exact: true })).toBeVisible()
    await expect(rows.last()).toContainText('CR !477')
    await expect(rows.last()).toContainText('No SP')
  })

  test('Should validate the dates of a custom range', async ({ page }) => {
    await page.getByLabel('Period').selectOption('custom')
    await page.getByLabel('From').fill('2030-01-10')
    await page.getByLabel('To').fill('2030-01-01')
    await expect(
      page.getByText('Pick a start date on or before the end date'),
    ).toBeVisible()
  })

  test('Should compare the estimate with the real time', async ({
    page,
    isMobile,
  }) => {
    await expect(page.getByText('Estimate vs. real time')).toBeVisible()
    const tasks = taskItems(page, isMobile)
    const row = tasks.filter({ hasText: 'PAY-142 Payment gateway integration' })
    await expect(row.getByText('est. 5h', { exact: true })).toBeVisible()
    await expect(row.getByText('55m over est.', { exact: true })).toBeVisible()
    const planning = tasks.filter({ hasText: 'Sprint planning' })
    await expect(planning.getByText('incl. 20m running over')).toBeVisible()

    await row
      .getByRole('button', {
        name: 'Edit task: PAY-142 Payment gateway integration',
      })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Edit task' })
    await expect(dialog.getByLabel('Estimate for the task')).toHaveValue('300')
    await expect(
      dialog.getByText('Real time so far: 5h 55m of 5h.'),
    ).toBeVisible()
    await dialog.getByLabel('Estimate for the task').fill('6h')
    await dialog.getByRole('button', { name: 'Save task' }).click()
    await expect(page.getByText('Task updated')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(row.getByText('5m under est.', { exact: true })).toBeVisible()
  })

  test('Should open a task from the report to edit it and its time', async ({
    page,
    isMobile,
  }) => {
    await page
      .getByRole('button', { name: 'Edit task: PAY-139 Refund API endpoint' })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Edit task' })
    await expect(dialog).toContainText('2 sessions, 5h 35m in total')
    await expectNoA11yViolations(page)

    // Zadanie: nowa nazwa trafia do obu sesji, czas zostaje.
    await dialog.getByLabel('Title').fill('PAY-139 Refund API')
    await dialog.getByRole('button', { name: 'Save task' }).click()
    await expect(page.getByText('Task updated')).toBeVisible()
    await expect(dialog).toContainText(
      'PAY-139 Refund API. 2 sessions, 5h 35m in total',
    )

    // Czas: edycja jednej sesji otwiera zwykły formularz wpisu.
    await dialog
      .getByRole('button', { name: /^Edit session from / })
      .first()
      .click()
    const edit = page.getByRole('dialog', { name: /^Edit session from / })
    await expect(edit.getByLabel('Title')).toHaveValue('PAY-139 Refund API')
    await edit.getByRole('button', { name: 'Cancel' }).click()
    await expect(edit).toBeHidden()

    // Usunięcie jednej sesji zmniejsza czas zadania w raporcie.
    await dialog
      .getByRole('button', { name: /^Delete session from / })
      .first()
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.getByText('Session deleted')).toBeVisible()
    await expect(dialog).toContainText('1 session, ')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    const row = taskItems(page, isMobile).filter({
      hasText: 'PAY-139 Refund API',
    })
    await expect(row.getByText(/^(2h 30m|3h 5m)$/)).toBeVisible()
  })
})

test.describe('story points per kind of work', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('Should require SP for tasks, keep them optional for reviews and hide them for meetings', async ({
    page,
  }) => {
    await page.goto('/app')
    const form = page.getByRole('region', { name: 'Log time' })
    const storyPoints = form.getByRole('group', { name: /^Story points/ })
    await expect(storyPoints).toContainText('(required)')
    await form.getByText('Code review', { exact: true }).click()
    await expect(storyPoints).toContainText('(optional)')
    await expect(
      storyPoints.getByRole('radio', { name: 'No SP' }),
    ).toBeChecked()
    await form.getByText('Meeting', { exact: true }).click()
    await expect(storyPoints).toBeHidden()
  })

  test('Should make SP required for code reviews in settings', async ({
    page,
  }) => {
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

test('Should show real numbers on the Tasks and Sprints pages with links to reports', async ({
  page,
}) => {
  await signInWithSamples(page)
  await page.getByRole('link', { name: 'Tasks', exact: true }).first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tasks' }),
  ).toBeVisible()
  const tasks = page.getByRole('main')
  await expect(
    tasks.getByRole('link', {
      name: 'PAY-142 Payment gateway integration',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('PAY-142')
  await expect(tasks.getByText(/^1 task$/)).toBeVisible()
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
