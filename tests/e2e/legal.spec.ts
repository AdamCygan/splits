import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './helpers'

for (const [path, heading] of [
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
  ['/cookies', 'Cookie Policy'],
] as const) {
  test(`${path} renders and has no axe violations`, async ({ page }) => {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'On this page' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })
}

test.describe('cookie consent', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('asks once, remembers the choice and can be reopened', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    const banner = page.getByRole('region', { name: 'Cookies, briefly' })
    await expect(banner).toBeVisible()
    await expectNoA11yViolations(page)
    await banner.getByRole('button', { name: 'Necessary only' }).click()
    await expect(banner).toBeHidden()
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'app_consent')?.value).toBe(
      'v1:necessary',
    )
    await page.reload()
    await expect(
      page.getByRole('region', { name: 'Cookies, briefly' }),
    ).toBeHidden()

    await page.getByRole('button', { name: 'Cookie settings' }).click()
    const settings = page.getByRole('region', { name: 'Cookies, briefly' })
    await expect(
      settings.getByRole('switch', { name: /statistics/i }),
    ).not.toBeChecked()
    await settings.getByRole('switch', { name: /statistics/i }).click()
    await settings.getByRole('button', { name: 'Save choice' }).click()
    expect(
      (await context.cookies()).find((c) => c.name === 'app_consent')?.value,
    ).toBe('v1:analytics')
  })

  test('the banner is rendered on the server (no flash)', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('Cookies, briefly')
  })
})
