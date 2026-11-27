import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  expectNoA11yViolations,
  lastCode,
  lastLink,
  signInWithSamples,
} from './helpers'

const notices = (page: Page) =>
  page.getByRole('region', { name: 'Account notices' })

test.describe('confirm email page', () => {
  test('Should explain a missing token and offer to log in', async ({
    page,
  }) => {
    await page.goto('/confirm-email')
    await expect(
      page.getByRole('heading', { level: 1, name: 'This link doesn’t work' }),
    ).toBeVisible()
    await expect(page.getByText(/This link is incomplete/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('Should reject an unknown or used link', async ({ page }) => {
    await page.goto('/confirm-email?token=not-a-real-token-123')
    await expect(
      page.getByRole('heading', { level: 1, name: 'This link doesn’t work' }),
    ).toBeVisible()
    await expect(
      page.getByText(/This link has expired or was already used/),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })
})

test.describe('unconfirmed email', () => {
  test('Should show a notice, send a new link and confirm the address with it', async ({
    page,
  }) => {
    const { email } = await signInWithSamples(page, { emailVerified: false })
    await expect(notices(page)).toContainText(
      `Confirm your email address: we sent a link to ${email}.`,
    )
    await expectNoA11yViolations(page)

    await notices(page)
      .getByRole('button', { name: 'Send the link again' })
      .click()
    await expect(page.getByText(`New link sent to ${email}`)).toBeVisible()

    await page.goto(await lastLink(page, email))
    await expect(
      page.getByRole('heading', { level: 1, name: 'Email address confirmed' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
    await page.getByRole('link', { name: 'Open Pointhours' }).click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(notices(page)).toHaveCount(0)
  })
})

test.describe('failed payment', () => {
  test('Should show a notice with a way to update the payment', async ({
    page,
  }) => {
    await signInWithSamples(page, { subscription: 'past_due' })
    await expect(notices(page)).toContainText(
      'Your last payment didn’t go through.',
    )
    await expect(
      notices(page).getByRole('button', { name: 'Update payment' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('Should show no notice while the subscription is active', async ({
    page,
  }) => {
    await signInWithSamples(page, { subscription: 'active' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(notices(page)).toHaveCount(0)
  })
})

test.describe('account email', () => {
  test('Should keep the email read-only and change it through a link sent to the new address', async ({
    page,
  }) => {
    const { email } = await signInWithSamples(page)
    const next = `new-${email}`
    await page.goto('/app/settings/account')
    const field = page.getByRole('textbox', { name: 'Email', exact: true })
    await expect(field).toHaveValue(email)
    await expect(field).toHaveAttribute('readonly', '')

    await page.getByRole('button', { name: 'Change email address' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change email address' })
    await dialog.getByRole('button', { name: 'Send confirmation link' }).click()
    await expect(dialog.getByText('Enter a valid email address.')).toBeVisible()
    await expectNoA11yViolations(page)
    await dialog.getByLabel('New email address').fill(next)
    await dialog.getByRole('button', { name: 'Send confirmation link' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText(`Waiting for confirmation: ${next}.`),
    ).toBeVisible()
    // Dopóki nowy adres nie jest potwierdzony, konto używa starego.
    await expect(field).toHaveValue(email)

    await page.goto(await lastLink(page, next))
    await expect(
      page.getByRole('heading', { level: 1, name: 'Email address changed' }),
    ).toBeVisible()
    await page.goto('/app/settings/account')
    await expect(
      page.getByRole('textbox', { name: 'Email', exact: true }),
    ).toHaveValue(next)
    await expect(page.getByText(/Waiting for confirmation/)).toHaveCount(0)
  })

  test('Should let the user cancel a pending change', async ({ page }) => {
    const { email } = await signInWithSamples(page)
    await page.goto('/app/settings/account')
    await page.getByRole('button', { name: 'Change email address' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change email address' })
    await dialog.getByLabel('New email address').fill(`other-${email}`)
    await dialog.getByRole('button', { name: 'Send confirmation link' }).click()
    await page.getByRole('button', { name: 'Cancel the change' }).click()
    await expect(page.getByText(/Waiting for confirmation/)).toHaveCount(0)
  })
})

test.describe('deleting the account', () => {
  test('Should delete the account only with the code sent by email', async ({
    page,
  }) => {
    const { email } = await signInWithSamples(page)
    await page.goto('/app/settings/account')
    await page.getByRole('button', { name: 'Delete my account' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' })
    await expect(dialog).toContainText(`We’ll send a 6-digit code to ${email}`)
    await dialog.getByRole('button', { name: 'Send code' }).click()
    await expect(
      dialog.getByText(`We sent a code to ${email}. It works for 15 minutes.`),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    const code = await lastCode(page, email)
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    const input = dialog.getByLabel('Code from the email')
    await input.fill(wrong)
    await dialog.getByRole('button', { name: 'Delete account' }).click()
    await expect(
      dialog.getByText(/That code isn’t right or has expired/),
    ).toBeVisible()

    await input.fill(code)
    await dialog.getByRole('button', { name: 'Delete account' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('invoices', () => {
  const invoices = [
    {
      id: 'in_2',
      number: 'PH-0002',
      date: '2026-11-20T10:00:00.000Z',
      total: 4900,
      currency: 'usd',
      status: 'paid',
      pdfUrl: 'https://pay.stripe.com/invoice/in_2/pdf',
      url: 'https://invoice.stripe.com/i/in_2',
    },
    {
      id: 'in_1',
      number: null,
      date: '2025-11-20T10:00:00.000Z',
      total: 4900,
      currency: 'usd',
      status: 'open',
      pdfUrl: null,
      url: 'https://invoice.stripe.com/i/in_1',
    },
  ]

  // Płatności (Stripe) są w e2e wyłączone: odpowiedzi API podstawiamy w przeglądarce.
  async function withBilling(page: Page, list: Array<unknown>) {
    await page.route('**/api/v1/billing', (route) =>
      route.fulfill({
        json: {
          enabled: true,
          plan: 'pro',
          subscription: {
            status: 'active',
            plan: 'pro',
            active: true,
            currentPeriodEnd: '2027-11-20T10:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
        },
      }),
    )
    await page.route('**/api/v1/billing/invoices', (route) =>
      route.fulfill({ json: list }),
    )
  }

  test('Should list invoices with their PDF and Stripe page', async ({
    page,
  }) => {
    await signInWithSamples(page, { subscription: 'active' })
    await withBilling(page, invoices)
    await page.goto('/app/settings/plan')
    const table = page.getByRole('table', {
      name: 'Your invoices, newest first',
    })
    await expect(table.getByRole('row')).toHaveCount(3)
    await expect(table.getByRole('row').nth(1)).toContainText('PH-0002')
    await expect(table.getByRole('row').nth(1)).toContainText('$49.00')
    await expect(table.getByRole('row').nth(1)).toContainText('Paid')
    await expect(table.getByRole('row').nth(2)).toContainText('Draft')
    await expect(table.getByRole('row').nth(2)).toContainText('Due')
    await expect(
      table.getByRole('link', { name: 'PDF of invoice PH-0002' }),
    ).toHaveAttribute('href', 'https://pay.stripe.com/invoice/in_2/pdf')
    await expect(
      table.getByRole('link', { name: 'View invoice PH-0002' }),
    ).toHaveAttribute('href', 'https://invoice.stripe.com/i/in_2')
    await expectNoA11yViolations(page)
  })

  test('Should explain when there are no invoices yet', async ({ page }) => {
    await signInWithSamples(page, { subscription: 'active' })
    await withBilling(page, [])
    await page.goto('/app/settings/plan')
    await expect(
      page.getByText(
        'No invoices yet. They show up here after your first payment.',
      ),
    ).toBeVisible()
  })

  test('Should hide invoices when payments are off', async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app/settings/plan')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invoices' })).toHaveCount(0)
  })
})
