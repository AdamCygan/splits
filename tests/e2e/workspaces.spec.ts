import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'
import type { Page } from '@playwright/test'

/** Przełącznik przestrzeni: w bocznym menu na komputerze, w górnym pasku na telefonie. */
const switcher = (page: Page) =>
  page
    .getByRole('button', { name: /^Workspace .+ \(switch\)$/ })
    .filter({ visible: true })

test.describe('workspaces', () => {
  test('Should keep a second job apart and switch between jobs from the menu, the keyboard and the daily question', async ({
    page,
    isMobile,
  }) => {
    await signInWithSamples(page, { subscription: 'active' })
    await expect(switcher(page)).toHaveAccessibleName(
      'Workspace My workspace (switch)',
    )
    const todaysEntries = page.getByRole('heading', { name: 'Today’s entries' })
    const sampleEntry = page.getByRole('link', {
      name: 'Staging certificate hotfix',
    })
    await expect(todaysEntries).toBeVisible()
    await expect(sampleEntry).toBeVisible()

    // Nowa przestrzeń z menu: kopiuje konfigurację, ale nie wpisy.
    await switcher(page).click()
    await page.getByRole('menuitem', { name: 'New workspace' }).click()
    const dialog = page.getByRole('dialog', { name: 'New workspace' })
    await dialog.getByLabel('Name').fill('Acme contract')
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Create workspace' }).click()
    await expect(dialog).toBeHidden()
    await expect(switcher(page)).toHaveAccessibleName(
      'Workspace Acme contract (switch)',
    )
    await expect(sampleEntry).toBeHidden()
    // Typy pracy skopiowane z pierwszej przestrzeni.
    await expect(
      page
        .getByRole('region', { name: 'Log time' })
        .getByText('Code review', { exact: true }),
    ).toBeVisible()

    // Powrót z menu.
    await switcher(page).click()
    await page.getByRole('menuitem', { name: /My workspace/ }).click()
    await expect(switcher(page)).toHaveAccessibleName(
      'Workspace My workspace (switch)',
    )
    await expect(sampleEntry).toBeVisible()

    // Skrót klawiszowy (komputer): Alt+Shift+2 to druga przestrzeń na liście.
    if (!isMobile) {
      await page.locator('body').click({ position: { x: 5, y: 5 } })
      await page.keyboard.press('Alt+Shift+2')
      await expect(switcher(page)).toHaveAccessibleName(
        'Workspace Acme contract (switch)',
      )
    }

    // Następnego dnia (brak zapisanego wyboru) aplikacja pyta raz, w czym dziś pracujesz.
    await page.evaluate(() => localStorage.removeItem('tb:workspace-picked-on'))
    await page.reload()
    const picker = page.getByRole('dialog', {
      name: 'What are you working on today?',
    })
    await expect(picker).toBeVisible()
    await expectNoA11yViolations(page)
    await picker.getByRole('button', { name: /My workspace/ }).click()
    await expect(picker).toBeHidden()
    await expect(switcher(page)).toHaveAccessibleName(
      'Workspace My workspace (switch)',
    )
    await page.reload()
    await expect(todaysEntries).toBeVisible()
    await expect(picker).toBeHidden()
  })

  test('Should offer a second workspace on Free only as part of Pro', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await switcher(page).click()
    const create = page.getByRole('menuitem', { name: /New workspace/ })
    await expect(create).toContainText('Pro')
    await create.click()
    await expect(page).toHaveURL(/\/app\/settings\/plan/)
  })
})
