import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, signInWithSamples } from './helpers'

test.describe('today: log time with notes', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithSamples(page)
    await page.goto('/app')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
  })

  test('page has no axe violations', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Log time' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('logs a code review with notes', async ({ page }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Code review', { exact: true }).click()
    await form.getByLabel('Title').fill('CR !486 Webhook retries')
    await form.getByRole('button', { name: 'Save entry' }).click()
    await expect(
      form.getByText('Paste the link. This kind of work needs one.'),
    ).toBeVisible()
    await form
      .getByLabel('Merge request link')
      .fill('https://gitlab.com/acme/shop/-/merge_requests/486')
    await form.getByRole('button', { name: '30m', exact: true }).click()
    await form.getByLabel('Notes').fill('Suggested exponential backoff.')
    await form.getByLabel('Notes').press('Control+Enter')
    const list = page.getByRole('region', { name: 'Today’s entries' })
    const item = list
      .getByRole('listitem')
      .filter({ hasText: 'CR !486 Webhook retries' })
    await expect(item.getByText('Suggested exponential backoff.')).toBeVisible()
    await expect(form.getByLabel('Title')).toBeFocused()
  })

  test('logs overtime with a description of what was done', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Extra work', { exact: true }).click()
    await form.getByLabel('Title').fill('Checkout hotfix after release')
    await form.getByRole('radio', { name: 'Duration' }).check({ force: true })
    await form.getByRole('button', { name: '2h', exact: true }).click()
    await form.getByRole('switch', { name: 'Overtime' }).click()
    // Bez opisu nie da się zapisać.
    await form.getByRole('button', { name: 'Save entry' }).click()
    await expect(
      form.getByText('Describe what you did in overtime.'),
    ).toBeVisible()
    await form.getByLabel('How much of it was overtime?').fill('1h 30m')
    await expect(form.getByText('1h 30m of 2h.')).toBeVisible()
    await form
      .getByLabel('What did you do in overtime?')
      .fill('Rolled back the cache change after the evening release.')
    await form.getByRole('button', { name: 'Save entry' }).click()

    const list = page.getByRole('region', { name: 'Today’s entries' })
    const item = list
      .getByRole('listitem')
      .filter({ hasText: 'Checkout hotfix after release' })
    await expect(item.getByText('Overtime 1h 30m')).toBeVisible()
    await expect(
      item.getByText('Rolled back the cache change after the evening release.'),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('adds notes to an existing entry later', async ({ page }) => {
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await list
      .getByRole('button', { name: /add notes.*staging certificate hotfix/i })
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Notes')).toBeFocused()
    await page.keyboard.type('Rotated the cert with certbot.')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()
    await expect(list.getByText('Rotated the cert with certbot.')).toBeVisible()
  })

  test('starts a timer without an end time and stops it from the bar', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Timer$/ })
      .click()
    await form.getByLabel('Title').fill('PAY-151 Refund emails')
    await form.getByRole('button', { name: 'Start timer' }).click()
    const bar = page.getByRole('region', { name: 'Running' })
    await expect(
      bar.getByText('PAY-151 Refund emails', { exact: true }),
    ).toBeVisible()
    await expect(bar.getByRole('timer')).toBeVisible()
    await expectNoA11yViolations(page)
    await bar.getByRole('button', { name: /stop/i }).click()
    await expect(bar).toBeHidden()
    await expect(page.getByText(/timer stopped/i)).toBeVisible()
  })

  test('switches to an urgent task and comes back as a new interval', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    const startTimer = async (title: string) => {
      await form
        .locator('label')
        .filter({ hasText: /^Timer$/ })
        .click()
      await form.getByLabel('Title').fill(title)
      await form.getByRole('button', { name: 'Start timer' }).click()
    }
    await startTimer('PAY-160 Invoice export')
    const bar = page.getByRole('region', { name: 'Running' })
    await expect(
      bar.getByText('PAY-160 Invoice export', { exact: true }),
    ).toBeVisible()

    // Nagłe zadanie: pierwsze się wstrzymuje i czeka na pasku.
    await startTimer('Prod incident')
    await expect(bar.getByText('Prod incident', { exact: true })).toBeVisible()
    await expect(
      page.getByText(/Paused “PAY-160 Invoice export”/),
    ).toBeVisible()
    await expect(
      bar.getByRole('list', { name: 'Paused tasks' }).getByRole('button', {
        name: /PAY-160 Invoice export/,
      }),
    ).toBeVisible()

    // Koniec nagłego zadania: pasek proponuje powrót.
    await bar.getByRole('button', { name: /stop/i }).click()
    const paused = page.getByRole('region', { name: 'Paused tasks' })
    await expect(
      paused.getByText('PAY-160 Invoice export', { exact: true }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
    await paused.getByRole('button', { name: /resume/i }).click()
    await expect(
      bar.getByText('PAY-160 Invoice export', { exact: true }),
    ).toBeVisible()
    await expect(paused).toBeHidden()

    // Na liście jedno zadanie z dwoma odcinkami czasu.
    const sessions = page
      .getByRole('region', { name: 'Today’s entries' })
      .getByRole('list', { name: 'Sessions of PAY-160 Invoice export' })
    await expect(sessions.getByRole('listitem')).toHaveCount(2)
    await expect(
      sessions.getByRole('listitem').last().getByRole('timer'),
    ).toBeVisible()
  })

  test('right-click on a work type opens quick durations', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse context menu')
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .getByText('Pair programming', { exact: true })
      .click({ button: 'right' })
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: 'Log 45m' }).click()
    await expect(
      form.getByRole('radio', { name: 'Pair programming' }),
    ).toBeChecked()
    await expect(form.getByRole('textbox', { name: 'Duration' })).toHaveValue(
      '45',
    )
    await expect(form.getByLabel('Title')).toBeFocused()
    // własny czas
    await form
      .getByText('Code review', { exact: true })
      .click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Custom duration…' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Duration').fill('1h 20m')
    await dialog.getByRole('button', { name: 'Use this duration' }).click()
    await expect(form.getByRole('textbox', { name: 'Duration' })).toHaveValue(
      '80',
    )
  })

  test('builds a task summary from all its entries', async ({ page }) => {
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await list.getByRole('button', { name: /summary.*PAY-142/i }).click()
    const text = page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Summary text' })
    await expect(text).toHaveValue(
      /Total time on PAY-142 Payment gateway integration: 5h 55m \(3 sessions, 3 days, 3 SP\)/,
    )
    await expect(text).toHaveValue(/- Built the signature check/)
    await expectNoA11yViolations(page)
  })

  test('a code review template asks for the project and the MR link', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /^Code review \(Pick a project\)/ })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Code review: a few details',
    })
    await expect(dialog.getByLabel('Project')).toBeFocused()
    await dialog.getByLabel('Project').selectOption({ label: 'Payments' })
    await dialog.getByRole('button', { name: 'Save entry' }).click()
    await expect(
      dialog.getByText('Paste the link. This kind of work needs one.'),
    ).toBeVisible()
    await dialog
      .getByLabel('Merge request link')
      .fill('https://gitlab.com/acme/shop/-/merge_requests/512')
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Save entry' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Logged “Code review”, 25m')).toBeVisible()

    // Alt+2 otwiera to samo okno; Escape niczego nie zapisuje.
    await page.keyboard.press('Alt+2')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('an any-project template is one click per project', async ({ page }) => {
    await page.goto('/app/settings/templates')
    await page.getByRole('button', { name: 'Add template' }).click()
    const form = page.getByRole('dialog', { name: 'Add template' })
    await form.getByLabel('Button label').fill('Sync')
    await form.getByLabel('Work type').selectOption({ label: 'Meeting' })
    await form.getByLabel('Entry title').fill('Team sync')
    await form.getByLabel('Duration in minutes').fill('20')
    await form
      .getByLabel('Project')
      .selectOption({ label: 'Any project, pick when using' })
    await expect(
      form.getByText('One template for all your projects'),
    ).toBeVisible()
    await form.getByRole('button', { name: 'Add template' }).click()
    await expect(page.getByText('Meeting, 20m, any project')).toBeVisible()

    await page.goto('/app')
    await page.getByRole('button', { name: /^Sync \(Pick a project\)/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Sync: which project?' })
    await expect(
      dialog.getByRole('button', { name: 'Mobile app' }),
    ).toBeFocused()
    await dialog.getByRole('button', { name: 'Payments' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Logged “Team sync”, 20m')).toBeVisible()
  })

  test('custom summary template is used', async ({ page }) => {
    await page.goto('/app/settings/summaries')
    const field = page.getByRole('textbox', { name: 'Template' })
    await field.fill('{key}: {total}. ')
    await page.getByRole('button', { name: /notes/i }).click()
    await expect(page.locator('pre')).toContainText('PAY-142: 4h 25m.')
    await page.getByRole('button', { name: /^save/i }).click()
    await expect(page.getByText('Template saved')).toBeVisible()
    await page.goto('/app')
    await page
      .getByRole('region', { name: 'Today’s entries' })
      .getByRole('button', { name: /summary.*PAY-142/i })
      .click()
    await expect(
      page.getByRole('dialog').getByRole('textbox', { name: 'Summary text' }),
    ).toHaveValue(/^PAY-142: 5h 55m\. - /)
  })
})
