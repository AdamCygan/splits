import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, testEach } from './helpers'

testEach([
  { path: '/terms', heading: 'Terms of Service' },
  { path: '/privacy', heading: 'Privacy Policy' },
  { path: '/cookies', heading: 'Cookie Policy' },
])(
  'Should render $path without axe violations',
  async ({ path, heading }, page) => {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'On this page' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  },
)

test.describe('cookie consent', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Should ask once, remember the choice and open again on request', async ({
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
    expect(cookies.find((cookie) => cookie.name === 'app_consent')?.value).toBe(
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
      (await context.cookies()).find((cookie) => cookie.name === 'app_consent')
        ?.value,
    ).toBe('v1:analytics')
  })

  test('Should render the banner on the server (no flash)', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('Cookies, briefly')
  })
})
