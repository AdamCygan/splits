import { describe, expect, it } from 'vitest'
import {
  FREE_LIMITS,
  freeUsage,
  PRO_PRICES,
  hasProAccess,
  isBillingInterval,
  plans,
  renewalDate,
  yearlyFreeMonths,
} from '../../src/features/billing/domain/plans'

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

describe('pricing', () => {
  it('Should offer only Free and Pro', () => {
    expect(plans.map((plan) => plan.id)).toEqual(['free', 'pro'])
  })

  it('Should charge $6 a month or $60 a year, two months free', () => {
    expect(PRO_PRICES).toEqual({ month: 6, year: 60 })
    expect(yearlyFreeMonths()).toBe(2)
  })

  it('Should keep the Free plan tightly limited', () => {
    expect(FREE_LIMITS).toEqual({
      historyDays: 7,
      customWorkTypes: 0,
      workspaces: 1,
      projects: 1,
      quickTemplates: 2,
      statuses: 4,
    })
  })

  it.each<[unknown, boolean]>([
    ['month', true],
    ['year', true],
    ['week', false],
    [undefined, false],
  ])('Should tell whether %s is a billing interval', (value, expected) => {
    expect(isBillingInterval(value)).toBe(expected)
  })

  it.each<[string, Parameters<typeof hasProAccess>[0], boolean]>([
    ['free', { plan: 'free', role: 'user' }, false],
    ['pro', { plan: 'pro', role: 'user' }, true],
    ['lifetime', { plan: 'lifetime', role: 'user' }, true],
    ['admin', { plan: 'free', role: 'admin' }, true],
  ])('Should decide Pro access for a %s account', (_unused, user, expected) => {
    expect(hasProAccess(user)).toBe(expected)
  })
})

describe('renewal date', () => {
  it.each<[string, 'month' | 'year', string, string]>([
    ['a month later', 'month', '2026-11-27', '2026-12-27'],
    ['across the new year', 'month', '2026-12-15', '2027-01-15'],
    ['on the last day of a shorter month', 'month', '2027-01-31', '2027-02-28'],
    ['a year later', 'year', '2026-11-27', '2027-11-27'],
    ['on 28 February after a leap day', 'year', '2028-02-29', '2029-02-28'],
  ])('Should renew %s', (_unused, interval, from, expected) => {
    expect(isoDate(renewalDate(interval, new Date(`${from}T12:00:00`)))).toBe(
      expected,
    )
  })
})

describe('free plan usage', () => {
  it('Should show how much of each Free limit is used', () => {
    expect(
      freeUsage({
        projects: 1,
        quickTemplates: 1,
        statuses: 4,
        customWorkTypes: 0,
      }),
    ).toEqual([
      { key: 'projects', used: 1, limit: 1, full: true },
      { key: 'quickTemplates', used: 1, limit: 2, full: false },
      { key: 'statuses', used: 4, limit: 4, full: true },
      { key: 'customWorkTypes', used: 0, limit: 0, full: true },
    ])
  })
})
