import { describe, expect, it } from 'vitest'
import { parseDateQuery } from '#/domain/date-query'

describe('parseDateQuery', () => {
  const today = '2026-11-26'
  it('understands words in both languages', () => {
    expect(parseDateQuery('yesterday', today)).toBe('2026-11-25')
    expect(parseDateQuery('Wczoraj', today)).toBe('2026-11-25')
    expect(parseDateQuery('dziś', today)).toBe('2026-11-26')
    expect(parseDateQuery('przedwczoraj', today)).toBe('2026-11-24')
  })
  it('reads ISO and day.month dates, never the future', () => {
    expect(parseDateQuery('2026-11-20', today)).toBe('2026-11-20')
    expect(parseDateQuery('20.11', today)).toBe('2026-11-20')
    expect(parseDateQuery('3.2.2026', today)).toBe('2026-02-03')
    expect(parseDateQuery('20.12', today)).toBe('2025-12-20')
    expect(parseDateQuery('2026-12-01', today)).toBeNull()
    expect(parseDateQuery('31.02', today)).toBeNull()
    expect(parseDateQuery('PAY-142', today)).toBeNull()
  })
})
