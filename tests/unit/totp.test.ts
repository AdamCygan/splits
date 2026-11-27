import { describe, expect, it } from 'vitest'
import { activeSessions } from '#/server/auth/sessions'
import {
  base32Decode,
  base32Encode,
  hashRecoveryCode,
  newRecoveryCodes,
  totpAt,
  verifyTotp,
} from '#/server/auth/totp'

// Wektor testowy z RFC 6238 (SHA-1): sekret "12345678901234567890".
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('TOTP', () => {
  it('Should match the RFC 6238 test vectors', () => {
    expect(base32Decode(SECRET).toString()).toBe('12345678901234567890')
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe(SECRET)
    expect(totpAt(SECRET, Math.floor(59 / 30))).toBe('287082')
    expect(totpAt(SECRET, Math.floor(1111111109 / 30))).toBe('081804')
    expect(totpAt(SECRET, Math.floor(1234567890 / 30))).toBe('005924')
  })

  it('Should accept one step of clock drift and never the same step twice', () => {
    const now = 1234567890_000
    const step = Math.floor(now / 30_000)
    expect(verifyTotp(SECRET, totpAt(SECRET, step - 1), null, now)).toBe(
      step - 1,
    )
    expect(verifyTotp(SECRET, totpAt(SECRET, step + 2), null, now)).toBeNull()
    expect(verifyTotp(SECRET, totpAt(SECRET, step), step, now)).toBeNull()
    expect(verifyTotp(SECRET, '12 34', null, now)).toBeNull()
  })

  it('Should make ten distinct backup codes that hash the same with or without the dash', () => {
    const codes = newRecoveryCodes()
    expect(new Set(codes).size).toBe(10)
    expect(codes[0]).toMatch(/^[a-f0-9]{5}-[a-f0-9]{5}$/)
    expect(hashRecoveryCode(codes[0]!)).toBe(
      hashRecoveryCode(codes[0]!.replace('-', '').toUpperCase()),
    )
  })
})

describe('active sessions', () => {
  const at = (iso: string) => new Date(iso)
  const row = (
    familyId: string,
    created: string,
    over: Partial<{ revokedAt: Date | null; expiresAt: Date }> = {},
  ) => ({
    familyId,
    userAgent: `UA ${familyId}`,
    ip: '1.2.3.4',
    createdAt: at(created),
    revokedAt: null,
    expiresAt: at('2030-01-01T00:00:00Z'),
    ...over,
  })

  it('Should show one entry per sign-in, current device first', () => {
    const now = at('2026-11-25T12:00:00Z')
    const list = activeSessions(
      [
        // Laptop: zalogowany 20.11, odświeżany (stary token unieważniony przy rotacji).
        row('laptop', '2026-11-20T08:00:00Z', {
          revokedAt: at('2026-11-25T09:00:00Z'),
        }),
        row('laptop', '2026-11-25T09:00:00Z'),
        row('phone', '2026-11-24T08:00:00Z'),
        // Wylogowany i przeterminowany: nie pokazujemy.
        row('old', '2026-11-01T08:00:00Z', {
          revokedAt: at('2026-11-02T08:00:00Z'),
        }),
        row('expired', '2026-10-01T08:00:00Z', {
          expiresAt: at('2026-10-31T08:00:00Z'),
        }),
      ],
      'phone',
      now,
    )
    expect(
      list.map((s) => [s.id, s.current, s.startedAt.slice(0, 10)]),
    ).toEqual([
      ['phone', true, '2026-11-24'],
      ['laptop', false, '2026-11-20'],
    ])
    expect(list[1]!.lastActiveAt).toBe('2026-11-25T09:00:00.000Z')
  })
})
