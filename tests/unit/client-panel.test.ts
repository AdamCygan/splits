import { describe, expect, it } from 'vitest'
import { isEmailToken } from '../../src/features/auth/domain/email-token'
import { accountNotices } from '../../src/features/notices/domain/notices'
import {
  emailChangeInput,
  isDeleteCode,
  isEmail,
  normalizeDeleteCode,
} from '../../src/features/account/domain/account-forms'
import { formatMoney } from '#/i18n/format'

const user = { emailVerified: true, isDemo: false }

describe('account notices', () => {
  it.each<[string, Parameters<typeof accountNotices>[0], Array<string>]>([
    ['nothing for a confirmed account', { user, subscriptionStatus: null }, []],
    [
      'the email notice for an unconfirmed address',
      { user: { ...user, emailVerified: false }, subscriptionStatus: null },
      ['unverified'],
    ],
    [
      'the payment notice for a past-due subscription',
      { user, subscriptionStatus: 'past_due' },
      ['pastDue'],
    ],
    [
      'the payment notice first when both apply',
      { user: { ...user, emailVerified: false }, subscriptionStatus: 'unpaid' },
      ['pastDue', 'unverified'],
    ],
    [
      'nothing for an active subscription',
      { user, subscriptionStatus: 'active' },
      [],
    ],
    [
      'nothing for a demo account',
      {
        user: { emailVerified: false, isDemo: true },
        subscriptionStatus: 'past_due',
      },
      [],
    ],
  ])('Should show %s', (_case, input, expected) => {
    expect(accountNotices(input)).toEqual(expected)
  })
})

describe('account settings model', () => {
  it.each([
    ['123456', '123456'],
    [' 123 456 ', '123456'],
    ['12-34-56-78', '123456'],
    ['abc', ''],
  ])('Should normalize the delete code "%s" to "%s"', (raw, code) => {
    expect(normalizeDeleteCode(raw)).toBe(code)
  })

  it.each([
    ['123456', true],
    ['12345', false],
    ['1234567', false],
    ['12a456', false],
  ])('Should treat "%s" as a delete code: %s', (code, valid) => {
    expect(isDeleteCode(code)).toBe(valid)
  })

  it.each([
    ['ada@example.com', true],
    ['  ada@example.com ', true],
    ['ada@', false],
    ['', false],
  ])('Should treat "%s" as an email: %s', (email, valid) => {
    expect(isEmail(email)).toBe(valid)
  })

  it('Should send the new email trimmed and missing secrets as null', () => {
    expect(
      emailChangeInput({ email: ' new@example.com ', password: '', code: ' ' }),
    ).toEqual({ email: 'new@example.com', password: null, code: null })
  })
})

describe('confirm email link', () => {
  it.each([
    ['a1B2c3D4e5_-x', true],
    ['short', false],
    ['has spaces in it', false],
    [42, false],
  ])('Should treat %s as a link token: %s', (token, valid) => {
    expect(isEmailToken(token)).toBe(valid)
  })
})

describe('money', () => {
  it.each([
    ['en-US', 4900, 'usd', '$49.00'],
    ['pl-PL', 19900, 'pln', '199,00 zł'],
    ['en-US', 500, 'jpy', '¥500'],
  ])(
    'Should format %s %i in %s as %s',
    (tag, minorUnits, currency, expected) => {
      expect(formatMoney(tag, minorUnits, currency).replace(/\s/g, ' ')).toBe(
        expected,
      )
    },
  )
})
