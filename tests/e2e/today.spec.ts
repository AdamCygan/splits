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

  test('Should have no axe violations', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Log time' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('Should log a code review with notes', async ({ page }) => {
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

  test('Should show just the time for a meeting logged as a duration', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Meeting', { exact: true }).click()
    await form.getByLabel('Title').fill('Sprint planning')
    await form.getByRole('radio', { name: 'Duration' }).check({ force: true })
    await form.getByRole('button', { name: '1h', exact: true }).click()
    await form.getByRole('button', { name: 'Save entry' }).click()

    const list = page.getByRole('region', { name: 'Today’s entries' })
    const item = list
      .getByRole('listitem')
      .filter({ hasText: 'Sprint planning' })
      .first()
    await expect(
      item.getByRole('list', { name: 'Sessions of Sprint planning' }),
    ).toHaveText(/^\s*1h\b/)
    await expect(item).not.toContainText('duration only')
  })

  test('Should log overtime with a description of what was done', async ({
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

  test('Should add notes to an existing entry later', async ({ page }) => {
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await list
      .getByRole('button', {
        name: /^More actions: Staging certificate hotfix, /,
      })
      .click()
    await page.getByRole('menuitem', { name: 'Add notes' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Notes')).toBeFocused()
    await page.keyboard.type('Rotated the cert with certbot.')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()
    await expect(list.getByText('Rotated the cert with certbot.')).toBeVisible()
  })

  test('Should start a timer without an end time and stop it from the bar', async ({
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

  test('Should edit the running task from the timer bar', async ({ page }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Timer$/ })
      .click()
    await form.getByLabel('Title').fill('PAY-152 Refund mails')
    await form.getByRole('button', { name: 'Start timer' }).click()
    const bar = page.getByRole('region', { name: 'Running' })
    await bar.getByRole('button', { name: 'Edit PAY-152 Refund mails' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit entry' })
    await dialog.getByLabel('Title').fill('PAY-152 Refund e-mails')
    await dialog.getByLabel('Notes').fill('Template copy from support')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    // Zmienia się wpis, a timer biegnie dalej.
    await expect(
      bar.getByText('PAY-152 Refund e-mails', { exact: true }),
    ).toBeVisible()
    await expect(bar.getByRole('timer')).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Today’s entries' }),
    ).toContainText('Template copy from support')
    await expectNoA11yViolations(page)
  })

  test('Should accept quick typing in time fields and follow the time format setting', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Start and end$/ })
      .click()
    const start = form.getByLabel('Start', { exact: true })
    const end = form.getByLabel('End', { exact: true })
    await start.fill('930')
    await end.fill('10:45')
    await end.press('Tab')
    // Wpisane skrótem, pokazane w formacie języka (EN: 12h).
    await expect(start).toHaveValue('9:30 AM')
    await expect(end).toHaveValue('10:45 AM')
    await expect(form.getByText('1h 15m')).toBeVisible()
    await end.press('ArrowUp')
    await expect(end).toHaveValue('10:50 AM')
    await expectNoA11yViolations(page)

    // Lista godzin pod zegarem.
    await form.getByRole('button', { name: 'Pick a time' }).first().click()
    await page.getByRole('button', { name: '2:00 PM', exact: true }).click()
    await expect(start).toHaveValue('2:00 PM')

    // 24h z menu konta: godziny na liście wpisów też się zmieniają.
    await page
      .getByRole('button', { name: /^Account menu/ })
      .locator('visible=true')
      .click()
    await page.getByRole('menuitemradio', { name: /^24-hour/ }).click()
    await expect(
      page.getByRole('region', { name: 'Today’s entries' }),
    ).toContainText('12:30–13:30')
  })

  test('Should duplicate an entry and save the edited copy as a new one', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form
      .locator('label')
      .filter({ hasText: /^Start and end$/ })
      .click()
    await form.getByLabel('Title').fill('PAY-190 Copy source')
    await form.getByLabel('Start', { exact: true }).fill('09:00')
    await form.getByLabel('End', { exact: true }).fill('10:00')
    await form.getByLabel('Notes').fill('Original note')
    await form.getByRole('button', { name: 'Save entry' }).click()
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await expect(list).toContainText('PAY-190 Copy source')

    await list
      .getByRole('button', { name: /^More actions: PAY-190 Copy source, / })
      .click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    const dialog = page.getByRole('dialog', { name: 'Duplicate entry' })
    // Wszystko skopiowane; kopia z godzinami dostaje kolejny przedział.
    await expect(dialog.getByLabel('Title')).toHaveValue('PAY-190 Copy source')
    await expect(dialog.getByLabel('Start', { exact: true })).toHaveValue(
      '10:00 AM',
    )
    await expect(dialog.getByLabel('End', { exact: true })).toHaveValue(
      '11:00 AM',
    )
    await expect(dialog.getByLabel('Notes')).toHaveValue('Original note')
    await expectNoA11yViolations(page)

    await dialog.getByLabel('Title').fill('PAY-191 Edited copy')
    await dialog.getByRole('button', { name: 'Save copy' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Copy saved')).toBeVisible()
    // Oryginał zostaje bez zmian obok kopii.
    await expect(list).toContainText('PAY-190 Copy source')
    await expect(list).toContainText('PAY-191 Edited copy')
  })

  test('Should switch to an urgent task and come back as a new interval', async ({
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

  test('Should open quick durations on right-click on a work type', async ({
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

  test('Should build a task summary from all its entries', async ({ page }) => {
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await list.getByRole('button', { name: /summary.*PAY-142/i }).click()
    const text = page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Summary text' })
    await expect(text).toHaveValue(
      /Total time on PAY-142 Payment gateway integration: 5h 55m \(3 sessions, 3 days, 3 SP\)/,
    )
    // Każda notatka z dniem i godzinami sesji.
    await expect(text).toHaveValue(
      /- [^\n]+, [^\n]+: Built the signature check/,
    )
    await expectNoA11yViolations(page)
  })

  test('Should ask for the project and the MR link in a code review template', async ({
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

  test('Should log an any-project template in one click per project', async ({
    page,
  }) => {
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

  test('Should add a forgotten entry to yesterday', async ({ page }) => {
    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(page).toHaveURL(/[?&]date=\d{4}-\d{2}-\d{2}/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Yesterday' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next day' })).toBeEnabled()

    const form = page.getByRole('region', { name: 'Log time' })
    await expect(form.getByText(/The timer works only for today/)).toBeVisible()
    await expect(form.getByRole('radio', { name: 'Timer' })).toHaveCount(0)
    await form.getByText('Meeting', { exact: true }).click()
    await form.getByLabel('Title').fill('Planning I forgot to log')
    await form.getByRole('radio', { name: 'Duration' }).check({ force: true })
    await form.getByRole('button', { name: '1h', exact: true }).click()
    await form.getByRole('button', { name: 'Save entry' }).click()

    const list = page.getByRole('region', { name: /^Entries on / })
    await expect(
      list.getByText('Planning I forgot to log', { exact: true }),
    ).toBeVisible()
    await expectNoA11yViolations(page)

    // Dziś tego wpisu nie ma; wraca się jednym przyciskiem.
    await page.getByRole('button', { name: 'Back to today' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible()
    await expect(page).not.toHaveURL(/date=/)
    await expect(
      page
        .getByRole('region', { name: 'Today’s entries' })
        .getByText('Planning I forgot to log'),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })

  test('Should ask for the time when a timer template is used on a past day', async ({
    page,
  }) => {
    await page.goto('/app/settings/templates')
    await page.getByRole('button', { name: 'Add template' }).click()
    const form = page.getByRole('dialog', { name: 'Add template' })
    await form.getByLabel('Button label').fill('Focus')
    await form.getByLabel('Work type').selectOption({ label: 'Meeting' })
    await form.getByLabel('Entry title').fill('Focus block')
    await form.getByRole('button', { name: 'Add template' }).click()
    await expect(page.getByText('Template added')).toBeVisible()

    await page.goto('/app')
    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Yesterday' }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Focus/ }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Focus: how long did it take?',
    })
    await expect(dialog.getByLabel('Time')).toBeFocused()
    await dialog.getByRole('button', { name: 'Save entry' }).click()
    await expect(
      dialog.getByText('Enter between 1 minute and 24 hours.'),
    ).toBeVisible()
    await dialog.getByLabel('Time').fill('1h 30m')
    await dialog.getByRole('button', { name: 'Save entry' }).click()
    await expect(page.getByText('Logged “Focus block”, 1h 30m')).toBeVisible()
  })

  test('Should add the extra time and a reason to a meeting that ran over', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^Stand-up/ }).click()
    await expect(page.getByText('Logged “Daily stand-up”, 15m')).toBeVisible()
    const list = page.getByRole('region', { name: 'Today’s entries' })
    const item = list
      .getByRole('listitem')
      .filter({ hasText: 'Daily stand-up' })
      .first()
    await item
      .getByRole('button', { name: /^More actions: / })
      .first()
      .click()
    await page.getByRole('menuitem', { name: 'Ran over' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Daily stand-up ran over',
    })
    await expect(dialog).toContainText('Planned 15m.')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByText('Add how much longer it took.')).toBeVisible()
    await dialog.getByRole('button', { name: '+15m' }).click()
    await expect(dialog.getByText(/New total: 30m\./)).toBeVisible()
    await dialog
      .getByLabel('Why did it run over?')
      .fill('Release questions from the QA team.')
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Added 15m to “Daily stand-up”')).toBeVisible()
    await expect(item.getByText('Ran over by 15m')).toBeVisible()
    await expect(
      item.getByText('Release questions from the QA team.'),
    ).toBeVisible()
    await expect(item.getByText('30m', { exact: true }).first()).toBeVisible()
  })

  test('Should log a task with an estimate for the whole task', async ({
    page,
  }) => {
    const form = page.getByRole('region', { name: 'Log time' })
    await form.getByText('Task', { exact: true }).click()
    await form.getByLabel('Title').fill('PAY-170 Invoice numbering')
    // Zadanie ma domyślnie godziny od–do, wypełnione ostatnimi 30 minutami.
    await form
      .locator('label')
      .filter({ hasText: /^3 SP$/ })
      .click()
    await form.getByLabel(/Estimate for the task/).fill('abc')
    await form.getByRole('button', { name: 'Save entry' }).click()
    await expect(
      form.getByText(/Enter the estimate like 90, 4h or 1h 30m/),
    ).toBeVisible()
    await form.getByLabel(/Estimate for the task/).fill('4h')
    await expect(form.getByText(/^= 4h\./)).toBeVisible()
    await form.getByRole('button', { name: 'Save entry' }).click()
    const list = page.getByRole('region', { name: 'Today’s entries' })
    await expect(
      list
        .getByRole('listitem')
        .filter({ hasText: 'PAY-170 Invoice numbering' })
        .first()
        .getByText('est. 4h'),
    ).toBeVisible()
  })

  test('Should use the custom summary template', async ({ page }) => {
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
