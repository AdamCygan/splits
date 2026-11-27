import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './helpers'

test('Should show the landing page in English by default without axe violations', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoA11yViolations(page)
})

test('Should switch the UI to Polish and remember the choice', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: /language/i }).selectOption('pl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  await expectNoA11yViolations(page)
})

test('Should move focus to the main content with the skip link', async ({
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
