import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('pricing and cart: yearly plans only', () => {
  test('pricing shows yearly prices only, without monthly billing', async ({
    page,
  }) => {
    await page.goto('/pricing')
    await expect(page.getByText('$24', { exact: true })).toBeVisible()
    await expect(
      page.getByText('That’s $2 a month, paid once a year'),
    ).toBeVisible()
    await expect(page.getByRole('radio', { name: /monthly/i })).toHaveCount(0)
    await expect(page.getByText(/lifetime/i)).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Join the waitlist' }),
    ).toHaveAttribute('href', /^mailto:/)
    await expectNoA11yViolations(page)
  })

  test('choosing Pro leads through sign-up straight to the cart', async ({
    page,
  }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: 'Get Pro for a year' }).click()
    await expect(page).toHaveURL(/\/register\?plan=pro/)
    await expect(page.getByText(/You picked Pro \(yearly\)/)).toBeVisible()
    const name = `buyer${Date.now().toString(36)}`
    await page.getByLabel('Username').fill(name)
    await page.getByLabel('Email').fill(`${name}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('correct horse 42')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page).toHaveURL(/\/app\/checkout\?plan=pro/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your cart' }),
    ).toBeVisible()
  })

  test('cart summary, consent and a clear notice when payments are off', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await page.goto('/app/settings/plan')
    await page.getByRole('link', { name: /Get Pro for a year, \$24/ }).click()
    await expect(page).toHaveURL(/\/app\/checkout\?plan=pro/)

    const summary = page.getByRole('region', { name: 'Order summary' })
    await expect(summary.getByText('Pro, 1 year')).toBeVisible()
    await expect(summary.getByText('Total today')).toBeVisible()
    await expect(summary.getByText(/Renews on .* for \$24/)).toBeVisible()
    // Serwer testowy nie ma klucza Stripe: zakup jest wyłączony z czytelnym komunikatem.
    await expect(summary.getByRole('alert')).toContainText(
      'Payments aren’t switched on yet',
    )
    await summary.getByRole('checkbox').check()
    await expect(
      summary.getByRole('button', { name: 'Continue to payment' }),
    ).toBeDisabled()
    await expectNoA11yViolations(page)

    await page.goto('/app/checkout?plan=pro&canceled=1')
    await expect(page.getByRole('status')).toContainText('Payment canceled')
  })
})
