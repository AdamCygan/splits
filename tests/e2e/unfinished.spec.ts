import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('today: pick up unfinished tasks', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
  })

  test('Should continue yesterday’s task in one click', async ({ page }) => {
    const section = page.getByRole('region', {
      name: 'Pick up where you left off',
    })
    await expect(section).toContainText('MOB-77 Push notification settings')
    await expect(section).toContainText('2h 20m logged in 1 session')
    // Zakończone zadania sprintu nie wracają na Dziś.
    await expect(section).not.toContainText('PAY-139')
    await expectNoA11yViolations(page)

    await section
      .getByRole('button', {
        name: 'Continue MOB-77 Push notification settings',
      })
      .click()
    await expect(
      page.getByRole('region', { name: 'Running', exact: true }),
    ).toContainText('MOB-77 Push notification settings')
    // Zadanie jest już na liście dnia, więc sekcja znika.
    await expect(section).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Today’s entries' }),
    ).toContainText('MOB-77 Push notification settings')
  })

  test('Should take a “Done” task off the list and reopen it from the task page', async ({
    page,
  }) => {
    const section = page.getByRole('region', {
      name: 'Pick up where you left off',
    })
    await section
      .getByRole('button', { name: 'Done: MOB-77 Push notification settings' })
      .click()
    await expect(
      page.getByText('“MOB-77 Push notification settings” marked as done'),
    ).toBeVisible()
    await expect(section).toHaveCount(0)

    await page.goto('/app/tasks')
    await page
      .getByRole('link', { name: 'MOB-77 Push notification settings' })
      .first()
      .click()
    await expect(page.getByText(/^Done \S+ \S+$/)).toBeVisible()
    await page.getByRole('button', { name: 'Not done yet' }).click()
    await expect(page.getByText('In progress', { exact: true })).toBeVisible()

    await page.goto('/app')
    await expect(section).toContainText('MOB-77 Push notification settings')
  })
})
