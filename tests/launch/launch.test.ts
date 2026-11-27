import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { launchProblems } from '#/config/launch-check'
import { legal } from '#/config/legal'
import { site } from '#/config/site'

/**
 * `pnpm check:launch`: lista rzeczy do uzupełnienia przed publicznym startem.
 * Przechodzi dopiero, gdy dane firmy, e-maile i domena są prawdziwe i spójne z fly.toml.
 */
const fly = readFileSync('fly.toml', 'utf8')
const flyValue = (key: string) =>
  new RegExp(`^\\s*${key}\\s*=\\s*'([^']*)'`, 'm').exec(fly)?.[1] ?? ''

describe('launch check', () => {
  it('Should have real company data and contact emails', () => {
    expect(
      launchProblems({
        legal,
        supportEmail: site.supportEmail,
        appUrl: flyValue('APP_URL'),
      }),
    ).toEqual([])
  })

  it('Should use one production domain everywhere in fly.toml', () => {
    const appUrl = flyValue('APP_URL')
    expect(appUrl).toMatch(/^https:\/\//)
    expect(flyValue('VITE_APP_URL')).toBe(appUrl)
    const host = new URL(appUrl).hostname
    expect(flyValue('EMAIL_FROM')).toContain(`@${host}>`)
  })
})
