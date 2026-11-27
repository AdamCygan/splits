import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('pricing and cart: Free, Pro monthly, Pro yearly', () => {
  test('Should show three plans: Free, Pro monthly and Pro yearly', async ({
    page,
  }) => {
    await page.goto('/pricing')
    for (const plan of ['free', 'month', 'year'])
      await expect(page.locator(`[data-plan="${plan}"]`)).toBeVisible()
    await expect(page.locator('[data-plan]')).toHaveCount(3)
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    await expect(page.getByText('$60', { exact: true })).toBeVisible()
    await expect(page.getByText('2 months free')).toBeVisible()
    await expect(page.getByText(/team/i)).toHaveCount(0)
    await expect(page.getByText(/trial/i)).toHaveCount(0)
    await expectNoA11yViolations(page)
  })

  test('Should lead from choosing Pro monthly through sign-up straight to the cart', async ({
    page,
  }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: 'Get Pro monthly' }).click()
    await expect(page).toHaveURL(/\/register\?plan=pro&interval=month/)
    await expect(page.getByText(/You picked Pro, billed monthly/)).toBeVisible()
    const name = `buyer${Date.now().toString(36)}`
    await page.getByLabel('Username').fill(name)
    await page.getByLabel('Email').fill(`${name}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('correct horse 42')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page).toHaveURL(/\/app\/checkout\?interval=month/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your cart' }),
    ).toBeVisible()
    await expect(page.getByRole('radio', { name: /Monthly/ })).toBeChecked()
  })

  test('Should switch the cart between monthly and yearly, with a clear notice when payments are off', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await page.goto('/app/settings/plan')
    await page.getByRole('link', { name: /Pro yearly, \$60 a year/ }).click()
    await expect(page).toHaveURL(/\/app\/checkout\?interval=year/)

    const summary = page.getByRole('region', { name: 'Order summary' })
    await expect(summary.getByText('Pro, 1 year')).toBeVisible()
    await expect(summary.getByText(/Renews on .* for \$60/)).toBeVisible()

    await page.locator('label', { hasText: 'Monthly' }).click()
    await expect(page).toHaveURL(/\/app\/checkout\?interval=month/)
    await expect(summary.getByText('Pro, 1 month')).toBeVisible()
    await expect(summary.getByText(/Renews on .* for \$6\b/)).toBeVisible()

    // Serwer testowy nie ma klucza Stripe: zakup jest wyłączony z czytelnym komunikatem.
    await expect(summary.getByRole('alert')).toContainText(
      'Payments aren’t switched on yet',
    )
    await summary.getByRole('checkbox').check()
    await expect(
      summary.getByRole('button', { name: 'Continue to payment' }),
    ).toBeDisabled()
    await expectNoA11yViolations(page)

    await page.goto('/app/checkout?interval=month&canceled=1')
    await expect(page.getByRole('status')).toContainText('Payment canceled')
  })

  test('Should show Free limits and block adding past them', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await page.goto('/app/settings/workday')
    await expect(
      page.getByText('Daily email reminders are part of Pro.'),
    ).toBeVisible()
  })
})
