import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('reports: day details', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app/analytics')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reports' }),
    ).toBeVisible()
  })

  test('Should open the day summary from a day column', async ({ page }) => {
    const chart = page.getByRole('group', {
      name: /move between columns, Enter opens the details/,
    })
    // Fokus wybiera ostatni dzień z danymi (dziś w przykładowych danych).
    await chart.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/day\?date=\d{4}-\d{2}-\d{2}/)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const stats = page.locator('dl').first()
    await expect(stats).toContainText('Worked')
    await expect(stats).toContainText('Focus work')
    await expect(stats).toContainText('Meetings')

    const tasks = page.getByRole('region', { name: 'Tasks' })
    await expect(
      tasks.getByRole('link', { name: 'Staging certificate hotfix' }),
    ).toBeVisible()
    await expect(tasks).toContainText(
      'Certificate expired at 19:30, renewed it and redeployed staging',
    )
    await expect(
      page.getByRole('region', { name: 'Where the time went' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    // Oś dnia: strzałki wybierają sesję, Enter otwiera jej zadanie.
    const timeline = page.getByRole('group', { name: /Day timeline/ })
    await timeline.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/task\?/)
  })

  test('Should move between days and back to editing', async ({ page }) => {
    await page.goto('/app/day')
    await page.getByRole('link', { name: 'Previous day' }).click()
    await expect(page).toHaveURL(/date=/)
    await expect(page.getByRole('link', { name: 'Next day' })).toBeVisible()
    await page.getByRole('link', { name: 'Edit this day' }).click()
    await expect(page).toHaveURL(/\/app\?date=/)
  })
})
