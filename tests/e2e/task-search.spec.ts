import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('log time: find a task and continue it', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
  })

  test('continues a finished task from the search', async ({ page }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    const search = form.getByRole('combobox', { name: 'Continue a task' })
    await search.fill('refund')
    const list = form.getByRole('listbox', { name: 'Matching tasks' })
    const option = list.getByRole('option').filter({ hasText: 'PAY-139' })
    // Zadanie z poprzedniego sprintu jest zakończone, a mimo to da się je znaleźć.
    await expect(option).toContainText('Done')
    await expectNoA11yViolations(page)

    await search.press('ArrowDown')
    await option.click()
    const selected = form.getByRole('group', {
      name: /Selected task: PAY-139/,
    })
    await selected.getByRole('button', { name: 'Continue now' }).click()
    await expect(
      page.getByRole('region', { name: 'Running', exact: true }),
    ).toContainText('PAY-139 Refund API endpoint')
    await expect(selected).toHaveCount(0)
  })

  test('fills the form with the chosen task', async ({ page }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    const search = form.getByRole('combobox', { name: 'Continue a task' })
    await search.fill('MOB-77')
    await expect(
      form.getByRole('option').filter({ hasText: 'MOB-77' }),
    ).toBeVisible()
    await search.press('Enter')
    await form.getByRole('button', { name: 'Fill the form' }).click()
    await expect(form.getByLabel('Title')).toHaveValue(
      'MOB-77 Push notification settings',
    )
    await expect(form.getByLabel('Title')).toBeFocused()
  })
})
