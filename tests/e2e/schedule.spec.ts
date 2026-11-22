import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('recurring meetings', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
  })

  test('the sample daily has its own time on Mondays', async ({ page }) => {
    await page.goto('/app/settings/templates')
    const daily = page.getByRole('listitem').filter({ hasText: 'Stand-up' })
    await expect(daily).toContainText('Repeats Mon 10:00 AM, Tue–Fri 9:30 AM')

    await daily.getByRole('button', { name: /^Edit/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('switch', { name: /Repeats on a schedule/ }),
    ).toBeChecked()
    await expect(
      dialog.getByRole('radio', { name: 'Different time each day' }),
    ).toBeChecked()
    await expect(dialog.getByLabel('Start time on Monday')).toHaveValue('10:00')
    await expect(dialog.getByLabel('Start time on Tuesday')).toHaveValue(
      '09:30',
    )
    await expectNoA11yViolations(page)
  })

  test('a recurring meeting shows up on Today and logs in one click', async ({
    page,
  }) => {
    await page.goto('/app/settings/templates')
    await page.getByRole('button', { name: 'Add template' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Button label').fill('Sync')
    await dialog.getByLabel('Work type').selectOption({ label: 'Meeting' })
    await dialog.getByLabel('Entry title').fill('Team sync')
    await dialog.getByRole('switch', { name: /Repeats on a schedule/ }).click()

    // Bez czasu trwania nie da się zapisać harmonogramu.
    await dialog.getByRole('button', { name: 'Add template' }).click()
    await expect(
      dialog.getByText('Recurring meetings need a duration.').first(),
    ).toBeVisible()
    await dialog.getByLabel('Duration in minutes').fill('20')

    // Każdy dzień tygodnia o północy, żeby spotkanie dziś już „się zaczęło”.
    for (const day of ['Sat', 'Sun'])
      await dialog.getByText(day, { exact: true }).click()
    await dialog.getByLabel('Start time', { exact: true }).fill('00:00')
    await dialog.getByRole('button', { name: 'Add template' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Sync' }),
    ).toContainText('Repeats Mon–Sun 12:00 AM')

    await page.goto('/app')
    const planned = page.getByRole('region', {
      name: 'Planned meetings today',
    })
    await expect(planned).toContainText('Sync')
    await planned
      .getByRole('button', { name: 'Log Sync, 12:00 AM–12:20 AM' })
      .click()
    await expect(planned.getByText('Logged')).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Today’s entries' }),
    ).toContainText('Team sync')
  })
})
