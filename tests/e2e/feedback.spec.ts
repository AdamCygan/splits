import { expect, test } from '@playwright/test'
import { expectNoA11yViolations, mailsTo, signInWithSamples } from './helpers'

test.describe('report a problem or idea', () => {
  test('Should send a report from the app, get a reply from an admin and see it under Help', async ({
    page,
    browser,
  }) => {
    const user = await signInWithSamples(page)
    const message = `The timer stops when I switch tabs (${Date.now()})`

    // Ten sam przycisk jest na stronie Pomoc na komputerze i telefonie.
    await page.goto('/app/settings/help')
    await page
      .getByRole('region', { name: 'Your reports' })
      .getByRole('button', { name: 'Report a problem or idea' })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Report a problem or idea',
    })
    await expect(
      dialog.getByText(/Sent: \/app\/settings\/help and/),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Send' }).click()
    await expect(dialog.getByText('Write at least 5 characters.')).toBeVisible()
    await dialog.getByLabel('Your message').fill(message)
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Send' }).click()
    await expect(
      page.getByText('Thanks! Your message reached us.'),
    ).toBeVisible()
    await expect(dialog).toBeHidden()

    const reports = page.getByRole('region', { name: 'Your reports' })
    await expect(reports.getByText(message)).toBeVisible()
    await expect(reports.getByText('Received')).toBeVisible()
    await expectNoA11yViolations(page)

    // Administrator w osobnej przeglądarce odpowiada na zgłoszenie.
    const adminContext = await browser.newContext()
    const admin = await adminContext.newPage()
    await signInWithSamples(admin, { role: 'admin' })
    await admin.goto('/app/admin/feedback')
    await expect(
      admin.getByRole('link', { name: /^Feedback/ }),
    ).toHaveAttribute('aria-current', 'page')
    const card = admin.getByRole('listitem').filter({ hasText: message })
    await expect(card.getByRole('link', { name: user.email })).toBeVisible()
    await card.getByLabel('Status').selectOption('done')
    await card
      .getByLabel('Reply to the user')
      .fill('Fixed in today’s release, thanks!')
    await card.getByRole('button', { name: 'Save' }).click()
    await expect(admin.getByText(`Reply sent to ${user.email}`)).toBeVisible()
    await expectNoA11yViolations(admin)
    await adminContext.close()

    const mails = await mailsTo(page, user.email)
    expect(mails.at(-1)?.text).toContain('Fixed in today’s release')

    await page.reload()
    await expect(reports.getByText('Done')).toBeVisible()
    await expect(
      reports.getByText('Fixed in today’s release, thanks!'),
    ).toBeVisible()
  })

  test('Should open the report window from the command palette', async ({
    page,
  }) => {
    await signInWithSamples(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Control+k')
    await page
      .getByRole('dialog', { name: 'Search and commands' })
      .getByRole('combobox')
      .fill('report bug')
    await page.getByRole('option', { name: /Report a problem or idea/ }).click()
    await expect(
      page.getByRole('dialog', { name: 'Report a problem or idea' }),
    ).toBeVisible()
  })
})
