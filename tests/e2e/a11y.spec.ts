import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { inSequence, numbered } from '../support/sequence'
import { settleAnimations, signInWithSamples, testEach } from './helpers'

/**
 * Przegląd dostępności całej aplikacji (WCAG 2.2 AA + dobre praktyki axe): każda strona
 * w obu motywach, układ przy 320 px, tryb wysokiego kontrastu, fokus pod przyklejonymi
 * paskami i odnośnik „Przejdź do treści”. Nowa strona = nowy wpis w listach poniżej.
 */
const publicPages = [
  '/',
  '/pricing',
  '/terms',
  '/privacy',
  '/cookies',
  '/accessibility',
  '/login',
  '/register',
  '/forgot-password',
]
const appPages = [
  '/app',
  '/app/tasks',
  '/app/sprints',
  '/app/analytics',
  '/app/day',
  '/app/settings',
  '/app/settings/workday',
  '/app/settings/sprints',
  '/app/settings/days-off',
  '/app/settings/story-points',
  '/app/settings/work-types',
  '/app/settings/statuses',
  '/app/settings/projects',
  '/app/settings/templates',
  '/app/settings/summaries',
  '/app/settings/account',
  '/app/settings/plan',
  '/app/settings/help',
  '/app/settings/workspaces',
]

const themedAppPages = (['light', 'dark'] as const).flatMap((theme) =>
  appPages.map((path) => ({ path, theme })),
)
const settingsPages = appPages.filter((appPage) =>
  appPage.startsWith('/app/settings'),
)

/** O ile piksli strona daje się przewinąć w bok (0 = mieści się w szerokości). */
async function sidewaysScroll(page: Page) {
  return page.evaluate(() => {
    window.scrollTo(400, window.scrollY)
    return window.scrollX
  })
}

async function violations(page: Page) {
  await settleAnimations(page)
  const result = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
      'best-practice',
    ])
    .analyze()
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  )
}

async function settle(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test.describe('accessibility sweep', () => {
  // Animacje wyłączone: axe ocenia stan końcowy, nie klatkę w połowie przejścia.
  test.use({ reducedMotion: 'reduce' })

  testEach(publicPages)(
    'Should pass WCAG 2.2 AA and best practices on %s',
    async (path, page) => {
      await page.goto(path)
      await settle(page)
      expect(await violations(page)).toEqual([])
    },
  )

  testEach(themedAppPages)(
    'Should pass WCAG 2.2 AA and best practices on $path in the $theme theme',
    async ({ path, theme }, page) => {
      await signInWithSamples(page)
      await page.evaluate(
        (messages) => localStorage.setItem('ph-theme', messages),
        theme,
      )
      await page.goto(path)
      await settle(page)
      expect(await violations(page)).toEqual([])
    },
  )

  testEach(publicPages)(
    'Should reflow %s at 320 px without sideways scrolling',
    async (path, page) => {
      await page.setViewportSize({ width: 320, height: 640 })
      await page.goto(path)
      await settle(page)
      expect(await sidewaysScroll(page)).toBe(0)
    },
  )

  testEach(appPages)(
    'Should reflow %s at 320 px without sideways scrolling',
    async (path, page) => {
      await signInWithSamples(page)
      await page.setViewportSize({ width: 320, height: 640 })
      await page.goto(path)
      await settle(page)
      expect(await sidewaysScroll(page)).toBe(0)
    },
  )

  test('Should move focus to the main content with the skip link', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await settle(page)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  testEach(settingsPages)(
    'Should open %s without a false “unsaved changes” bar',
    async (path, page) => {
      await signInWithSamples(page)
      await page.goto(path)
      await settle(page)
      await expect(
        page.getByRole('region', { name: 'You have unsaved changes' }),
      ).toHaveCount(0)
    },
  )
})

test.describe('high-contrast mode', () => {
  test.use({ forcedColors: 'active', reducedMotion: 'reduce' })

  test('Should keep focus and the selected item visible', async ({ page }) => {
    await signInWithSamples(page)
    await settle(page)
    // Fokus: system usuwa cienie (ring), więc musi zostać obrys.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const element = document.activeElement
      return element ? getComputedStyle(element).outlineStyle : 'none'
    })
    expect(outline).not.toBe('none')
    // Wybrana opcja (rodzaj pracy w formularzu) i bieżąca strona w menu mają tło systemowe.
    const selectedBackground = await page.evaluate(() => {
      const active = document.querySelector('[data-status="active"]')
      return active ? getComputedStyle(active).backgroundColor : ''
    })
    expect(selectedBackground).not.toMatch(
      /^(rgba\(0, 0, 0, 0\)|transparent)?$/,
    )
  })
})

test.describe('focus is not hidden under sticky bars', () => {
  test.use({ reducedMotion: 'reduce' })

  test('Should keep every stop visible when tabbing through a settings page', async ({
    page,
  }, info) => {
    test.setTimeout(120_000)
    await signInWithSamples(page)
    // Działający timer = pasek na górze; na telefonie jest też dolna nawigacja.
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Timer$/ })
      .click()
    await form.getByLabel('Title').fill('A11Y-1 Focus check')
    await form.getByRole('button', { name: 'Start timer' }).click()
    await page.goto('/app/settings/workday')
    await settle(page)
    const stops = await inSequence(numbered(45), async () => {
      await page.keyboard.press('Tab')
      return page.evaluate(() => {
        const element = document.activeElement
        const isNotFocusable =
          !(element instanceof HTMLElement) || element === document.body
        if (isNotFocusable) return null
        // Ukryte pole (np. checkbox w etykiecie) sprawdzamy po widocznej etykiecie.
        const label =
          element.closest('label') ??
          (element.id
            ? document.querySelector(`label[for="${element.id}"]`)
            : null)
        const target =
          element.classList.contains('sr-only') && label instanceof HTMLElement
            ? label
            : element
        const boundingClientRect = target.getBoundingClientRect()
        const isHidden =
          boundingClientRect.width === 0 || boundingClientRect.height === 0
        if (isHidden) return null
        const centerX = boundingClientRect.left + boundingClientRect.width / 2
        const centerY = boundingClientRect.top + boundingClientRect.height / 2
        const top = document.elementFromPoint(centerX, centerY)
        const covered =
          !!top && !target.contains(top) && !top.contains(target)
            ? !!top.closest(
                'header, nav, [role="region"], [data-sonner-toaster]',
              )
            : false
        return covered
          ? `${element.tagName} "${(element.getAttribute('aria-label') ?? element.textContent).trim().slice(0, 40)}" under ${top?.closest('header, nav, [role="region"]')?.getAttribute('aria-label') ?? top?.tagName}`
          : null
      })
    })
    const hidden = stops.filter((stop) => stop !== null)
    expect(hidden, info.project.name).toEqual([])
  })
})
