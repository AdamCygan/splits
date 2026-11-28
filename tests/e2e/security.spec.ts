import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signInWithSamples, testEach } from './helpers'

/**
 * Nagłówki bezpieczeństwa w przeglądarce: CSP z nonce'em nie może blokować niczego, czego
 * strona potrzebuje (hydracja, motyw, JSON-LD), a wstrzyknięty skrypt bez nonce'a nie działa.
 */
const publicPages = ['/', '/pricing', '/login', '/register', '/privacy']
const appPages = [
  '/app',
  '/app/tasks',
  '/app/analytics',
  '/app/settings/account',
]

/**
 * Naruszenia CSP zgłoszone przez przeglądarkę: komunikaty w konsoli i zdarzenia
 * securitypolicyviolation (np. zablokowane eval, którego Chrome nie wypisuje w konsoli).
 */
function watchViolations(page: Page) {
  const found: Array<string> = []
  page.on('console', (message) => {
    if (/Content Security Policy|csp-violation/i.test(message.text()))
      found.push(message.text())
  })
  void page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.warn(
        `csp-violation ${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
      )
    })
  })
  return found
}

test.describe('security headers', () => {
  test('Should send a nonce-based CSP that changes on every page load', async ({
    page,
  }) => {
    const first = await page.goto('/')
    const second = await page.goto('/pricing')
    const policy = (await first!.allHeaders())['content-security-policy']
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{16,}'/)
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain('unsafe-eval')
    const nonceOf = (value: string | undefined) =>
      /'nonce-([^']+)'/.exec(value ?? '')?.[1]
    expect(nonceOf(policy)).not.toBe(
      nonceOf((await second!.allHeaders())['content-security-policy']),
    )
    expect((await first!.allHeaders())['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains',
    )
  })

  testEach(publicPages)(
    'Should load %s without CSP violations',
    async (path, page) => {
      const violations = watchViolations(page)
      await page.goto(path)
      await expect(page.locator('main').first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      expect(violations).toEqual([])
    },
  )

  testEach(appPages)(
    'Should load %s without CSP violations',
    async (path, page) => {
      await signInWithSamples(page)
      const violations = watchViolations(page)
      await page.goto(path)
      await expect(page.locator('main').first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      expect(violations).toEqual([])
    },
  )

  test('Should block an injected inline script', async ({ page }) => {
    const violations = watchViolations(page)
    await page.goto('/')
    await page.evaluate(() => {
      const script = document.createElement('script')
      script.textContent = 'window.__injected = true'
      document.body.append(script)
    })
    expect(
      await page.evaluate(
        () => (window as unknown as { __injected?: boolean }).__injected,
      ),
    ).toBeUndefined()
    expect(violations.length).toBeGreaterThan(0)
  })

  test('Should publish security.txt with a contact and an expiry', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/security.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toMatch(/^Contact: mailto:.+@.+$/m)
    expect(text).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m)
  })
})
