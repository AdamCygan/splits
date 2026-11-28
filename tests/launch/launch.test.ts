import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { launchProblems } from '#/config/launch-check'
import { legal } from '#/config/legal'
import { site } from '#/config/site'

/**
 * `pnpm check:launch` (z produkcyjnym VITE_APP_URL): lista rzeczy do uzupełnienia przed startem.
 * Przechodzi dopiero, gdy dane firmy, e-maile i domena są prawdziwe i spójne.
 */
const envExample = readFileSync('.env.example', 'utf8')
const emailFrom = /^EMAIL_FROM=(.*)$/m.exec(envExample)?.[1]?.trim() ?? ''

describe('launch check', () => {
  it('Should have real company data and contact emails', () => {
    expect(
      launchProblems({
        legal,
        supportEmail: site.supportEmail,
        appUrl: site.url,
      }),
    ).toEqual([])
  })

  it('Should use one production domain for the site and e-mails', () => {
    expect(site.url).toMatch(/^https:\/\//)
    const host = new URL(site.url).hostname
    expect(emailFrom).toContain(`@${host}>`)
    expect(site.supportEmail).toMatch(new RegExp(`@${host}$`))
  })
})
