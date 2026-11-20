import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('notes: formatting', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
  })

  test('formats a note with the toolbar and ticks a checkbox on the list', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Task', { exact: true }).click()
    await form.getByLabel('Title').fill('PAY-180 Notes editor')
    await form
      .locator('label')
      .filter({ hasText: /^2 SP$/ })
      .click()

    const notes = form.getByLabel('Notes')
    const toolbar = form.getByRole('toolbar', { name: 'Formatting' })
    await notes.click()
    await page.keyboard.type('Plan')
    await toolbar.getByRole('button', { name: 'Heading' }).click()
    await notes.press('End')
    await notes.press('Enter')
    await toolbar.getByRole('button', { name: 'Checklist' }).click()
    // Enter w liście dodaje kolejny checkbox; Enter w pustej pozycji kończy listę.
    await page.keyboard.type('write tests')
    await notes.press('Enter')
    await page.keyboard.type('review')
    await notes.press('Enter')
    await notes.press('Enter')
    await page.keyboard.type('Ran ')
    await notes.press('Control+b')
    await page.keyboard.type('all')
    await notes.press('End')
    await notes.press('Enter')
    await toolbar.getByRole('button', { name: 'Code block' }).click()
    await page.keyboard.type('pnpm test')
    await expect(notes).toHaveValue(
      '## Plan\n- [ ] write tests\n- [ ] review\n\nRan **all**\n```\npnpm test\n```',
    )

    await toolbar.getByRole('button', { name: 'Preview' }).click()
    const preview = form.getByRole('region', { name: 'Note preview' })
    await expect(preview.getByRole('heading', { name: 'Plan' })).toBeVisible()
    await expect(preview.getByRole('checkbox')).toHaveCount(2)
    await expect(preview.locator('strong', { hasText: 'all' })).toBeVisible()
    await expect(preview.locator('pre')).toHaveText('pnpm test')
    await expectNoA11yViolations(page)
    await toolbar.getByRole('button', { name: 'Preview' }).click()

    await form.getByRole('button', { name: 'Save entry' }).click()
    const list = page.getByRole('region', { name: 'Today’s entries' })
    const item = list
      .getByRole('listitem')
      .filter({ hasText: 'PAY-180 Notes editor' })
      .first()
    await expect(
      item.getByRole('heading', { level: 4, name: 'Plan' }),
    ).toBeVisible()
    const box = item.getByRole('checkbox', { name: 'write tests' })
    await expect(box).not.toBeChecked()
    await box.check()
    await expect(box).toBeChecked()
    await page.reload()
    await expect(
      page
        .getByRole('region', { name: 'Today’s entries' })
        .getByRole('listitem')
        .filter({ hasText: 'PAY-180 Notes editor' })
        .first()
        .getByRole('checkbox', { name: 'write tests' }),
    ).toBeChecked()
  })

  test('plain notes written before markdown look the same', async ({
    page,
  }) => {
    await page.goto('/app/tasks')
    await page
      .getByRole('link', { name: 'PAY-139 Refund API endpoint' })
      .first()
      .click()
    const notes = page.getByRole('region', { name: 'Notes' })
    await expect(
      notes.getByText(
        'Endpoint and validation done. Partial refunds need their own ledger entry.',
      ),
    ).toBeVisible()
    await expect(notes.getByRole('heading', { level: 3 })).toHaveCount(0)
    await expect(notes.getByRole('list')).toHaveCount(1)
  })
})
