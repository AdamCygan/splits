import AxeBuilder from '@axe-core/playwright'
import { expect, request, test } from '@playwright/test'
import type { Page } from '@playwright/test'

export interface SampleAccountOptions {
  locale?: 'en' | 'pl'
  /** Domyślnie potwierdzony adres e-mail. */
  emailVerified?: boolean
  /** Subskrypcja Pro w danym stanie Stripe. */
  subscription?: 'active' | 'past_due'
  /** Konto administratora. */
  role?: 'client' | 'admin'
  /** Włączone logowanie dwuetapowe. */
  twoFactor?: boolean
}

export interface SampleAccount {
  id: string
  email: string
  displayName: string
}

/**
 * Loguje do nowego konta z przykładowymi danymi (endpoint testowy, ENABLE_TEST_ROUTES=1).
 * page.request dzieli ciasteczka ze stroną, więc /app odtworzy sesję z refresh tokenu.
 */
export async function signInWithSamples(
  page: Page,
  localeOrOptions: 'en' | 'pl' | SampleAccountOptions = 'en',
): Promise<SampleAccount> {
  const options =
    typeof localeOrOptions === 'string'
      ? { locale: localeOrOptions }
      : localeOrOptions
  const response = await page.request.post('/api/v1/test/sample-account', {
    data: {
      locale: options.locale ?? 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      emailVerified: options.emailVerified ?? true,
      subscription: options.subscription,
      role: options.role ?? 'client',
      twoFactor: options.twoFactor ?? false,
    },
  })
  expect(response.status()).toBe(201)
  const session = (await response.json()) as { user: SampleAccount }
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app/)
  return session.user
}

/**
 * Drugie konto z przykładowymi danymi w osobnym kontekście (bez ciasteczek strony), np. klient
 * oglądany w panelu admina. Jego logowanie to jedno zalogowane urządzenie.
 */
export async function createSampleAccount(
  options: SampleAccountOptions = {},
): Promise<SampleAccount> {
  const context = await request.newContext({
    baseURL: test.info().project.use.baseURL,
  })
  const response = await context.post('/api/v1/test/sample-account', {
    data: {
      locale: options.locale ?? 'en',
      timezone: 'UTC',
      emailVerified: options.emailVerified ?? true,
      subscription: options.subscription,
      role: options.role ?? 'client',
      twoFactor: options.twoFactor ?? false,
    },
  })
  expect(response.status()).toBe(201)
  const session = (await response.json()) as { user: SampleAccount }
  await context.dispose()
  return session.user
}

export interface SentEmail {
  subject: string
  text: string
}

/** E-maile, które serwer testowy „wysłał” na adres (od najstarszego). */
export async function mailsTo(page: Page, to: string) {
  const response = await page.request.get(
    `/api/v1/test/outbox?to=${encodeURIComponent(to)}`,
  )
  return (await response.json()) as Array<SentEmail>
}

/** Ścieżka z linkiem z ostatniego e-maila na adres (np. /confirm-email?token=…). */
export async function lastLink(page: Page, to: string) {
  const mail = (await mailsTo(page, to))
    .reverse()
    .find((m) => /token=/.test(m.text))
  const url = mail && /https?:\/\/\S+/.exec(mail.text)?.[0]
  if (!url) throw new Error(`no link sent to ${to}`)
  const { pathname, search } = new URL(url)
  return pathname + search
}

/** 6-cyfrowy kod z ostatniego e-maila na adres. */
export async function lastCode(page: Page, to: string) {
  const mail = (await mailsTo(page, to)).at(-1)
  const code = mail && /^(\d{6})$/m.exec(mail.text)?.[1]
  if (!code) throw new Error(`no code sent to ${to}`)
  return code
}

/**
 * Czeka, aż skończą się skończone animacje i przejścia CSS (np. wjazd powiadomienia).
 * axe liczy kontrast z bieżącej przezroczystości, więc w trakcie animacji widzi za słaby tekst.
 * Animacje bez końca (wskaźnik ładowania, pulsujący timer) są pomijane.
 */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  )
}

/** Zero naruszeń WCAG 2.2 A/AA wg axe. */
export async function expectNoA11yViolations(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary).toEqual([])
}

/** Na telefonie filtry zadań są zwinięte pod przyciskiem „Filters”: rozwija go, jeśli jest. */
export async function openTaskFilters(page: Page) {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if (await toggle.isVisible()) await toggle.click()
}

/** Tytuł przypadku jak w it.each: `%s` = wartość, `$pole` = pole obiektu. */
function caseTitle<TCase>(title: string, item: TCase) {
  if (typeof item === 'object' && item !== null)
    return title.replace(/\$(\w+)/g, (_, key: string) =>
      String((item as Record<string, unknown>)[key]),
    )
  return title.replace('%s', String(item))
}

/**
 * Odpowiednik it.each dla Playwrighta (który go nie ma): osobny test na każdy przypadek,
 * więc raport pokazuje, która strona albo który wariant nie przeszedł.
 */
export function testEach<TCase>(cases: ReadonlyArray<TCase>) {
  return (title: string, body: (item: TCase, page: Page) => Promise<void>) => {
    cases.forEach((item) => {
      test(caseTitle(title, item), async ({ page }) => body(item, page))
    })
  }
}
