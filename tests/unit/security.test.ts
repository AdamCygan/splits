import { describe, expect, it } from 'vitest'
import { safeUrl } from '../../src/features/time-entries/domain/entries'
import { securityTxt } from '#/routes/[.]well-known/security[.]txt'
import { clientIp } from '#/server/http/client-ip'
import { sameOrigin } from '#/server/http/origin'
import {
  PAGE_SECURITY_HEADERS,
  contentSecurityPolicy,
  posthogAssetsOrigin,
} from '#/server/security-headers'

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split('; ').map((part) => {
      const [name, ...values] = part.split(' ')
      return [name, values]
    }),
  )

describe('Content-Security-Policy', () => {
  it('Should allow only our own scripts and the request nonce', () => {
    const csp = directives(contentSecurityPolicy({ nonce: 'abc123' }))
    expect(csp['script-src']).toEqual(["'self'", "'nonce-abc123'"])
    expect(csp['script-src']).not.toContain("'unsafe-inline'")
    expect(csp['script-src']).not.toContain("'unsafe-eval'")
  })

  it('Should forbid plugins, framing, foreign forms and base changes', () => {
    const csp = directives(contentSecurityPolicy({ nonce: 'n' }))
    expect(csp).toMatchObject({
      'default-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    })
  })

  it('Should add PostHog and a separate API origin to the allowed hosts', () => {
    const csp = directives(
      contentSecurityPolicy({
        nonce: 'n',
        apiUrl: 'https://api.example.com/v1',
        posthogHost: 'https://eu.i.posthog.com',
      }),
    )
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://api.example.com',
      'https://eu.i.posthog.com',
      'https://eu-assets.i.posthog.com',
    ])
    expect(csp['script-src']).toContain('https://eu-assets.i.posthog.com')
  })

  it.each([
    ['https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com'],
    ['https://us.i.posthog.com', 'https://us-assets.i.posthog.com'],
    ['https://analytics.example.com', null],
  ])('Should map the PostHog host %s to its assets host', (host, assets) => {
    expect(posthogAssetsOrigin(host)).toBe(assets)
  })

  it('Should send HSTS, nosniff and a deny-all frame policy on pages', () => {
    expect(PAGE_SECURITY_HEADERS).toMatchObject({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
  })
})

describe('client IP', () => {
  const request = (headers: Record<string, string>) => ({
    header: (name: string) => headers[name],
  })

  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['203.0.113.7, 10.0.0.1', '203.0.113.7'],
    ['2001:db8::1', '2001:db8::1'],
    ['not-an-ip', null],
    ['', null],
  ])('Should read %j from the trusted header as %j', (value, expected) => {
    expect(clientIp(request({ 'x-real-ip': value }), 'x-real-ip')).toBe(
      expected,
    )
  })

  it('Should ignore client-supplied headers other than the trusted one', () => {
    const spoofed = request({
      'fly-client-ip': '198.51.100.1',
      'x-forwarded-for': '198.51.100.2',
    })
    expect(clientIp(spoofed, 'x-real-ip')).toBeNull()
  })
})

describe('same-origin check for cookie endpoints', () => {
  const base = {
    requestUrl: 'https://app.example.com/api/v1/auth/refresh',
    appUrl: 'https://app.example.com',
  }

  it.each([
    ['https://app.example.com', 'same-origin', true],
    [undefined, undefined, true],
    ['https://evil.example.net', undefined, false],
    [undefined, 'cross-site', false],
    ['https://app.example.com', 'cross-site', false],
  ])(
    'Should treat origin %s with Sec-Fetch-Site %s as allowed=%s',
    (origin, fetchSite, allowed) => {
      expect(sameOrigin({ ...base, origin, fetchSite })).toBe(allowed)
    },
  )
})

describe('safe links', () => {
  it.each([
    [
      'https://jira.example.com/browse/PH-1',
      'https://jira.example.com/browse/PH-1',
    ],
    ['  http://example.com  ', 'http://example.com'],
    ['javascript:alert(1)', undefined],
    ['JaVaScRiPt:alert(1)', undefined],
    ['data:text/html,<script>alert(1)</script>', undefined],
    ['//evil.example.net', undefined],
    [null, undefined],
  ])('Should turn %j into the href %j', (value, expected) => {
    expect(safeUrl(value)).toBe(expected)
  })
})

describe('security.txt', () => {
  it('Should list a contact and an expiry within a year', () => {
    const now = new Date('2026-11-27T12:00:00Z')
    const text = securityTxt(now, 'security@example.com')
    expect(text).toContain('Contact: mailto:security@example.com')
    const expires = /^Expires: (.+)$/m.exec(text)?.[1]
    expect(expires).toBe('2027-05-26T12:00:00Z')
    expect(text).toMatch(
      /^Canonical: https?:\/\/.+\/\.well-known\/security\.txt$/m,
    )
  })
})
