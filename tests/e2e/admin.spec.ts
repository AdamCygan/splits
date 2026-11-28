import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  createSampleAccount,
  expectNoA11yViolations,
  signInWithSamples,
} from './helpers'

test.describe('admin panel', () => {
  test('Should keep regular users out', async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app/admin')
    await expect(page).toHaveURL(/\/app$/)
  })

  test('Should filter, sort and export users with the filters in the address', async ({
    page,
  }) => {
    await signInWithSamples(page, { role: 'admin' })
    const other = await createSampleAccount({ emailVerified: false })
    await page.goto('/app/admin')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Users' }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Key numbers' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    await page.getByLabel('Email', { exact: true }).selectOption('unverified')
    await expect(page).toHaveURL(/email=unverified/)
    await page.getByLabel('Search users').fill(other.email)
    await expect(page).toHaveURL(/q=sample-/)
    const rows = page.getByRole('row').filter({ hasText: other.email })
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText('Email not confirmed')

    await page.getByRole('button', { name: /^Entries/ }).click()
    await expect(page).toHaveURL(/sort=entries&dir=desc/)

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^timeblame-users-.+\.csv$/)
    const csv = await readFile(await file.path(), 'utf8')
    expect(csv).toContain(other.email)
    await expect(page.getByText('Exported 1 account')).toBeVisible()

    // Link z filtrami otwiera tę samą listę.
    await page.reload()
    await expect(page.getByLabel('Search users')).toHaveValue(other.email)
    await expect(rows).toHaveCount(1)
  })

  test('Should help a customer on their account page and record every step', async ({
    page,
  }) => {
    await signInWithSamples(page, { role: 'admin' })
    const other = await createSampleAccount({
      emailVerified: false,
      twoFactor: true,
    })
    await page.goto('/app/admin')
    await page.getByLabel('Search users').fill(other.email)
    // Klik od razu, zanim wyszukiwanie trafi do adresu: spóźniony filtr nie może cofnąć na listę.
    await page
      .getByRole('row')
      .filter({ hasText: other.email })
      .getByRole('link', { name: other.displayName })
      .click()
    await expect(page).toHaveURL(new RegExp(`/app/admin/users/${other.id}$`))
    const security = page.getByRole('region', { name: 'Security' })
    await expect(security).toContainText(other.email)
    await expect(security).toContainText('Not confirmed')
    await expect(page.getByRole('region', { name: 'Payments' })).toContainText(
      'Payments are off on this server.',
    )
    await expectNoA11yViolations(page)

    await security
      .getByRole('button', { name: 'Send confirmation link' })
      .click()
    await expect(
      page.getByText(`Confirmation link sent to ${other.email}`),
    ).toBeVisible()

    await security
      .getByRole('button', { name: /^Log out / })
      .first()
      .click()
    await expect(page.getByText(/has been logged out$/)).toBeVisible()
    await expect(
      security.getByText('Not signed in on any device.'),
    ).toBeVisible()

    await security
      .getByRole('button', { name: 'Turn off two-step login' })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Turn off two-step login for Sample account?',
    })
    await dialog
      .getByRole('button', { name: 'Turn off two-step login' })
      .click()
    await expect(
      dialog.getByText('Write at least 10 characters.'),
    ).toBeVisible()
    await expectNoA11yViolations(page)
    await dialog
      .getByLabel('How you confirmed the owner’s identity')
      .fill('Replied from the account email with the invoice number')
    await dialog
      .getByRole('button', { name: 'Turn off two-step login' })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(security).toContainText('Two-step login')
    await expect(security.getByText('Off', { exact: true })).toBeVisible()

    const history = page.getByRole('region', {
      name: 'Activity log for this account',
    })
    await expect(history).toContainText('Two-step login turned off')
    await expect(history).toContainText('Device logged out')
    await expect(history).toContainText('Confirmation link sent')

    await page.getByRole('button', { name: 'Block account' }).click()
    await page
      .getByRole('alertdialog', { name: 'Block Sample account?' })
      .getByRole('button', { name: 'Block account' })
      .click()
    await expect(page.getByText(/^Blocked since/)).toBeVisible()

    await page
      .getByRole('region', { name: 'Delete account' })
      .getByRole('button', { name: 'Delete account' })
      .click()
    const confirm = page.getByRole('dialog', { name: 'Delete Sample account?' })
    const remove = confirm.getByRole('button', { name: 'Delete account' })
    await expect(remove).toBeDisabled()
    await confirm.getByLabel('Account email').fill(other.email)
    await remove.click()
    await expect(page).toHaveURL(/\/app\/admin$/)
    await expect(
      page.getByText('Account Sample account has been deleted'),
    ).toBeVisible()
  })

  test('Should filter the activity log with the filters in the address', async ({
    page,
  }) => {
    await signInWithSamples(page, { role: 'admin' })
    await page.goto('/app/admin')
    await page
      .getByRole('navigation', { name: 'Admin sections' })
      .getByRole('link', { name: 'Activity log' })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Activity log' }),
    ).toBeVisible()
    await page.getByLabel('Action').selectOption('user.blocked')
    await expect(page).toHaveURL(/action=user\.blocked/)
    await expectNoA11yViolations(page)
  })
})
