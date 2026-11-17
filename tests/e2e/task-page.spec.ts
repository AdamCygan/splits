import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('task page', () => {
  test.beforeEach(async ({ page }) => signInWithSamples(page))

  test('shows everything about one task, opened from the report', async ({
    page,
  }) => {
    await page.goto('/app/analytics')
    await page
      .getByRole('link', { name: 'PAY-142 Payment gateway integration' })
      .first()
      .click()
    await expect(page).toHaveURL(/\/app\/task\?type=.+&title=PAY-142/)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'PAY-142 Payment gateway integration',
      }),
    ).toBeVisible()

    const stats = page.locator('dl').first()
    await expect(stats).toContainText('Total time5h 55m')
    await expect(stats).toContainText('estimate 5h, 55m over')
    await expect(stats).toContainText('Sessions3')
    await expect(stats).toContainText('Days worked3')
    await expect(stats).toContainText('Interruptions0')

    await expect(
      page.getByRole('region', { name: 'Day by day' }),
    ).toContainText('1 session')
    await expect(page.getByRole('region', { name: 'Notes' })).toContainText(
      'idempotency key',
    )
    await expect(
      page.getByRole('region', { name: 'What pulled you away' }),
    ).toContainText('Nothing logged between the sessions')
    await expectNoA11yViolations(page)

    // Kontynuacja z poziomu zadania włącza timer.
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('region', { name: 'Running', exact: true }),
    ).toContainText('PAY-142 Payment gateway integration')
  })

  test('renaming the task keeps you on its page', async ({ page }) => {
    await page.goto('/app/tasks')
    await page
      .getByRole('link', { name: 'PAY-139 Refund API endpoint' })
      .first()
      .click()
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'PAY-139 Refund API endpoint',
      }),
    ).toBeVisible()
    await page.getByLabel('Title').fill('PAY-139 Refund API')
    await page.getByRole('button', { name: 'Save task' }).click()
    await expect(page.getByText('Task updated')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'PAY-139 Refund API' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/title=PAY-139\+Refund\+API(&|$)/)
  })

  test('the task title on Today opens the task page', async ({ page }) => {
    await page.goto('/app')
    await page
      .getByRole('region', { name: 'Today’s entries' })
      .getByRole('link', {
        name: 'PAY-142 Payment gateway integration',
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: /PAY-142/ }),
    ).toBeVisible()
  })
})
