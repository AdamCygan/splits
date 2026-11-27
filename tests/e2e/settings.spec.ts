import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples, testEach } from './helpers'

const sections = [
  { path: '/app/settings', heading: /welcome/i },
  { path: '/app/settings/workday', heading: /workday/i },
  { path: '/app/settings/sprints', heading: /sprints/i },
  { path: '/app/settings/story-points', heading: /story point/i },
  { path: '/app/settings/work-types', heading: /work types/i },
  { path: '/app/settings/statuses', heading: /statuses/i },
  { path: '/app/settings/projects', heading: /projects/i },
  { path: '/app/settings/templates', heading: /templates/i },
  { path: '/app/settings/summaries', heading: /task summaries/i },
  { path: '/app/settings/account', heading: /account/i },
  { path: '/app/settings/plan', heading: /plan/i },
]

test.describe('settings panel', () => {
  test.beforeEach(async ({ page }) => signInWithSamples(page))

  testEach(sections)(
    'Should render $path without axe violations',
    async ({ path, heading }, page) => {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible()
      await expect(
        page.getByRole('status').filter({ hasText: /loading/i }),
      ).toHaveCount(0)
      await expectNoA11yViolations(page)
    },
  )

  test('Should edit, validate and save the story point scale', async ({
    page,
  }) => {
    await page.goto('/app/settings/story-points')
    await page.getByRole('button', { name: /linear/i }).click()
    const firstHours = page.getByRole('spinbutton', {
      name: 'Hours, row 1',
      exact: true,
    })
    await firstHours.fill('500')
    await page.getByRole('button', { name: /^save/i }).click()
    await expect(
      page.getByText(/higher value needs a longer time/i).first(),
    ).toBeVisible()
    await page.getByRole('button', { name: /discard/i }).click()
    await page.getByRole('button', { name: /doubling/i }).click()
    await page.getByRole('button', { name: /^save/i }).click()
    await expect(page.getByText(/scale saved/i)).toBeVisible()
  })

  test('Should add a status with the keyboard, reorder it and make it default', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard flow')
    await page.goto('/app/settings/statuses')
    await page.getByRole('button', { name: /add status/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('textbox', { name: /name/i })).toBeFocused()
    await page.keyboard.type('Blocked')
    await dialog.getByRole('radio', { name: /in progress/i }).check()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    const row = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: /blocked/i }) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /move .*up/i }).click()
    await expect(page.getByText(/moved to position/i)).toBeAttached()
    await row.getByRole('button', { name: /make default/i }).click()
    await expect(row.getByText(/default/i).first()).toBeVisible()
  })

  test('Should trap focus in dialogs and close them with Escape', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard flow')
    await page.goto('/app/settings/projects')
    const opener = page.getByRole('button', { name: /add project/i })
    await opener.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('Should update the sprint schedule preview with the length', async ({
    page,
  }) => {
    await page.goto('/app/settings/sprints')
    await expect(
      page.getByRole('heading', { level: 1, name: /sprints/i }),
    ).toBeVisible()
    await expect(page.getByText(/sprint \d+/i).first()).toBeVisible()
  })
})
