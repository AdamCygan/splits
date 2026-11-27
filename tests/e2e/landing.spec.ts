import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
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

/**
 * Przewija pasek z klasą fill-on-view w górną część ekranu i zwraca skale jego kawałków
 * (0 = pusty, 1 = pełny). Sekcje z content-visibility dostają prawdziwą wysokość dopiero
 * przy przewijaniu, więc pozycję liczymy na nowo przy każdym wywołaniu.
 */
async function fillScales(page: Page, selector: string) {
  return page.evaluate(async (sel) => {
    const bars = [...document.querySelectorAll<HTMLElement>(sel)]
    bars[0]!.scrollIntoView({ block: 'start', behavior: 'instant' })
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    )
    return bars.map((bar) => new DOMMatrix(getComputedStyle(bar).transform).a)
  }, selector)
}

test.describe('landing motion', () => {
  test('Should split the grey sprint bar into work types in the hero', async ({
    page,
  }) => {
    await page.goto('/')
    const hero = page.locator('[role=img]:has(.split-cover)')
    await expect(hero.locator('.split-cover')).toHaveCSS('opacity', '0')
    await expect(hero.locator('.split-segment').first()).toHaveCSS(
      'opacity',
      '1',
    )
  })

  test('Should fill the timeline bars once they scroll into view', async ({
    page,
  }) => {
    await page.goto('/')
    // Pasek nad końcowym wezwaniem jest daleko poniżej ekranu: jeszcze pusty.
    const below = await page.$$eval(
      'section[aria-labelledby=final-title] .fill-on-view',
      (bars) =>
        bars.map((bar) => new DOMMatrix(getComputedStyle(bar).transform).a),
    )
    expect(new Set(below)).toEqual(new Set([0]))
    await expect
      .poll(async () => {
        const scales = await fillScales(page, '#features .fill-on-view')
        return scales.every((scale) => scale === 1)
      })
      .toBe(true)
  })

  test('Should show full bars right away with reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const scales = await page.$$eval('.fill-on-view', (bars) =>
      bars.map((bar) => getComputedStyle(bar).transform),
    )
    expect(new Set(scales)).toEqual(new Set(['none']))
  })
})
