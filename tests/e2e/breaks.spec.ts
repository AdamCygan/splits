import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('breaks', () => {
  test.beforeEach(async ({ page }) => signInWithSamples(page))

  test('Should set the daily break limit in settings', async ({ page }) => {
    await page.goto('/app/settings/workday')
    await page.getByLabel('Breaks per day').selectOption('45')
    await page.getByRole('button', { name: 'Save changes' }).click()
    // Pełny tekst powiadomienia: samo „Saved” pasuje też do ukrytego paska „You have unsaved changes”.
    await expect(page.getByText('Changes saved')).toBeVisible()
    await page.goto('/app')
    await expect(page.getByText('0m of 45m')).toBeVisible()
  })

  test('Should pause the running task during a break and resume it afterwards', async ({
    page,
  }) => {
    await page.goto('/app')
    // Szablon bez czasu nie istnieje w danych przykładowych, więc timer włączamy z formularza.
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Meeting', { exact: true }).click()
    await form.getByLabel('Title').fill('Deep work block')
    await form.getByText('Timer', { exact: true }).click()
    await form.getByRole('button', { name: /Start timer/ }).click()
    const timer = page.getByRole('region', { name: 'Running', exact: true })
    await expect(timer).toContainText('Deep work block')

    await timer.getByRole('button', { name: 'Break' }).click()
    await expect(
      page.getByText('Break started, “Deep work block” paused'),
    ).toBeVisible()
    const bar = page.getByRole('region', { name: 'On a break' })
    await expect(bar).toContainText(/left today/)
    await expect(bar.getByRole('timer')).toBeVisible()
    await expectNoA11yViolations(page)

    await bar.getByRole('button', { name: 'End break and resume' }).click()
    await expect(page.getByText(/Break over: 1m/)).toBeVisible()
    await expect(bar).toHaveCount(0)
    await expect(timer).toContainText('Deep work block')
    await expect(page.getByText('1m of 30m')).toBeVisible()
  })

  test('Should add a forgotten break and delete it', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: 'Manage breaks' }).click()
    const dialog = page.getByRole('dialog', { name: 'Breaks' })
    await expect(dialog.getByText('No breaks on this day yet.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Add a break' }).click()
    await expect(
      dialog.getByText('Enter a time from 1 minute, e.g. 15 or 1h.'),
    ).toBeVisible()
    await dialog.getByLabel('From').fill('12:00')
    await dialog.getByLabel('To', { exact: true }).fill('12:40')
    await dialog.getByRole('button', { name: 'Add a break' }).click()
    await expect(page.getByText('Break added: 40m')).toBeVisible()
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')

    // 40 z 30 minut: ponad limit.
    await expect(page.getByText('40m of 30m', { exact: true })).toBeVisible()
    await expect(page.getByText('10m over', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Manage breaks' }).click()
    await dialog.getByRole('button', { name: /^Delete break / }).click()
    await expect(page.getByText('Break deleted')).toBeVisible()
    await expect(dialog.getByText('No breaks on this day yet.')).toBeVisible()
  })
})
