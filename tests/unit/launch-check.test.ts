import { describe, expect, it } from 'vitest'
import { launchProblems } from '#/config/launch-check'

const ready = {
  legal: {
    operator: {
      name: 'Adam Example Software',
      address: 'ul. Prosta 1, 00-001 Warszawa, Polska',
      ids: 'NIP: 5250000000, REGON: 000000000, CEIDG',
    },
    email: { support: 'support@splits.dev', privacy: 'privacy@splits.dev' },
    processors: {
      hosting: 'Fly.io, Inc. (region Frankfurt)',
      database: 'Neon, Inc. (region UE)',
      email: 'Resend, Inc.',
    },
  },
  supportEmail: 'support@splits.dev',
  appUrl: 'https://splits.dev',
}

describe('launchProblems', () => {
  it('passes with real company data', () => {
    expect(launchProblems(ready)).toEqual([])
  })

  it('lists every placeholder and example address', () => {
    const problems = launchProblems({
      ...ready,
      legal: {
        ...ready.legal,
        operator: { ...ready.legal.operator, ids: '[NIP: …]' },
        email: { ...ready.legal.email, privacy: 'privacy@example.com' },
      },
      supportEmail: 'support@example.com',
      appUrl: 'http://localhost:3000',
    })
    expect(problems).toHaveLength(4)
    expect(problems.join('\n')).toMatch(/legal\.operator\.ids/)
    expect(problems.join('\n')).toMatch(/site\.supportEmail/)
    expect(problems.join('\n')).toMatch(/legal\.email\.privacy/)
    expect(problems.join('\n')).toMatch(/localhost/)
  })
})
