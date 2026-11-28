import { describe, expect, it } from 'vitest'
import {
  conversionRate,
  monthlyRecurring,
  adminUsersCsv,
  isPaymentProblem,
  nextAdminSort,
} from '../../src/features/admin/domain/admin'
import type { AdminCsvUser } from '../../src/features/admin/domain/admin'
import { csvCell, toCsv } from '../../src/shared/domain/csv'
import {
  activeUserFilters,
  pageCount,
  parseActionSearch,
  parseUserSearch,
} from '../../src/features/admin/domain/filters'

describe('admin sorting', () => {
  it.each<
    [string, Parameters<typeof nextAdminSort>, ReturnType<typeof nextAdminSort>]
  >([
    [
      'flip the direction of the same column',
      [{ sort: 'entries', dir: 'desc' }, 'entries'],
      { sort: 'entries', dir: 'asc' },
    ],
    [
      'start text columns from A to Z',
      [{ sort: 'entries', dir: 'desc' }, 'email'],
      { sort: 'email', dir: 'asc' },
    ],
    [
      'start other columns from the largest',
      [{ sort: 'name', dir: 'asc' }, 'lastActive'],
      { sort: 'lastActive', dir: 'desc' },
    ],
  ])('Should %s', (_case, callArguments, expected) => {
    expect(nextAdminSort(...callArguments)).toEqual(expected)
  })
})

describe('payment problems', () => {
  it.each([
    ['past_due', true],
    ['unpaid', true],
    ['active', false],
    ['canceled', false],
    [null, false],
  ])(
    'Should treat the subscription status %s as a problem: %s',
    (status, problem) => {
      expect(isPaymentProblem(status)).toBe(problem)
    },
  )
})

describe('csv', () => {
  it.each([
    ['plain', 'plain'],
    ['a, b', '"a, b"'],
    ['say "hi"', '"say ""hi"""'],
    ['=SUM(A1)', "'=SUM(A1)"],
    [null, ''],
    [42, '42'],
  ])('Should write %s as %s', (value, cell) => {
    expect(csvCell(value)).toBe(cell)
  })

  it('Should join rows with CRLF and end with a new line', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b', true],
      ]),
    ).toBe('a,1\r\nb,true\r\n')
  })

  it('Should export accounts with their status and no secrets', () => {
    const user: AdminCsvUser = {
      id: 'u1',
      username: 'ada',
      email: 'ada@example.com',
      displayName: 'Ada, L.',
      role: 'client',
      plan: 'pro',
      isDemo: false,
      disabledAt: '2026-11-01T00:00:00.000Z',
      emailVerified: true,
      twoFactor: false,
      subscription: { status: 'past_due' },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: null,
      lastActiveAt: '2026-11-20T10:00:00.000Z',
      entries: 12,
    }
    const [head, row] = adminUsersCsv([user]).trim().split('\r\n')
    expect(head).toBe(
      'id,username,email,display_name,role,plan,status,email_verified,two_factor,subscription_status,created_at,last_login_at,last_entry_at,entries',
    )
    expect(row).toBe(
      'u1,ada,ada@example.com,"Ada, L.",client,pro,blocked,true,false,past_due,2026-01-01T00:00:00.000Z,,2026-11-20T10:00:00.000Z,12',
    )
  })
})

describe('admin filters in the address', () => {
  it('Should keep known filters and drop unknown or empty values', () => {
    expect(
      parseUserSearch({
        q: '  ada ',
        plan: 'gold',
        status: 'blocked',
        payment: 'problem',
        email: 'unverified',
        twoFactor: 'maybe',
        inactiveDays: '30',
        sort: 'entries',
        dir: 'up',
        page: '0',
      }),
    ).toEqual({
      q: 'ada',
      status: 'blocked',
      payment: 'problem',
      email: 'unverified',
      inactiveDays: 30,
      sort: 'entries',
    })
  })

  it('Should read activity log filters', () => {
    expect(
      parseActionSearch({
        action: 'user.blocked',
        admin: '',
        target: 'ada',
        page: '2',
      }),
    ).toEqual({ action: 'user.blocked', target: 'ada', page: 2 })
  })

  it.each([
    [{}, 0],
    [{ q: 'ada', sort: 'name' as const }, 0],
    [{ plan: 'pro' as const, inactiveDays: 30 }, 2],
  ])('Should count active filters in %o as %i', (filter, count) => {
    expect(activeUserFilters(filter)).toBe(count)
  })

  it.each([
    [0, 25, 1],
    [25, 25, 1],
    [26, 25, 2],
  ])(
    'Should give %i items in pages of %i as %i pages',
    (total, size, pages) => {
      expect(pageCount(total, size)).toBe(pages)
    },
  )
})

describe('revenue numbers', () => {
  it.each<[number, number, number]>([
    [0, 0, 0],
    [10, 0, 6000],
    [0, 12, 6000],
    [3, 1, 2300],
  ])(
    'Should count %i monthly and %i yearly subscriptions as %i cents a month',
    (monthly, yearly, cents) => {
      expect(monthlyRecurring(monthly, yearly)).toBe(cents)
    },
  )

  it.each<[number, number, number]>([
    [0, 0, 0],
    [1, 3, 33.3],
    [25, 1000, 2.5],
  ])('Should show %i paying of %i accounts as %d%%', (paid, users, rate) => {
    expect(conversionRate(paid, users)).toBe(rate)
  })
})
