import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './helpers'

const unique = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

test.describe('accounts on the real server', () => {
  test('sign up, log out and log back in', async ({ page }) => {
    const name = `ada${unique()}`
    await page.goto('/register')
    await expectNoA11yViolations(page)
    await page.getByLabel('Username').fill(name)
    await page.getByLabel('Email').fill(`${name}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('correct horse 42')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page).toHaveURL(/\/app\/settings/)

    // Sesja przetrwa odświeżenie strony (refresh token w ciasteczku httpOnly).
    await page.reload()
    await expect(page).toHaveURL(/\/app\/settings/)

    await page.getByRole('button', { name: 'Log out' }).first().click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Username or email').fill(`${name}@example.com`)
    await page.getByLabel('Password').fill('wrong password 1')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toContainText('isn’t right')
    await page.getByLabel('Password').fill('correct horse 42')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/app/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
  })

  test('the username is taken only once', async ({ page }) => {
    const name = `bob${unique()}`
    await page.request.post('/api/v1/auth/register', {
      data: {
        username: name,
        email: `${name}@example.com`,
        password: 'correct horse 42',
        locale: 'en',
      },
    })
    await page.goto('/register')
    await page.getByLabel('Username').fill(name.toUpperCase())
    await page.getByLabel('Email').fill(`other-${name}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('correct horse 42')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create/i }).click()
    await expect(
      page.getByText('This username is already taken.'),
    ).toBeVisible()
  })

  test('forgot and reset password pages', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByRole('button', { name: 'Send link' }).click()
    await expect(
      page.getByRole('heading', { name: 'Check your inbox' }),
    ).toBeVisible()

    await page.goto('/reset-password')
    await expect(page.getByRole('alert')).toContainText('incomplete')
    await page.goto('/reset-password?token=this-is-not-a-real-token')
    await expectNoA11yViolations(page)
    await page
      .getByLabel('New password', { exact: true })
      .fill('brand new pass 7')
    await page.getByLabel('Repeat the new password').fill('brand new pass 7')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByRole('alert')).toContainText('expired')
  })

  test('hides Google sign-in when it is not configured', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Continue with Google' }),
    ).toHaveCount(0)
    await page.goto('/login?error=google_unavailable')
    await expect(page.getByRole('alert')).toContainText('Google')
  })
})
