import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './helpers'

test('landing is English by default and accessible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoA11yViolations(page)
})

test('language switcher changes the UI to Polish and remembers it', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: /language/i }).selectOption('pl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  await expectNoA11yViolations(page)
})

test('skip link moves focus to the main content', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard only')
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: /skip to/i })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
})
