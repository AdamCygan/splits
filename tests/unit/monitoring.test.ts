import { afterEach, describe, expect, it } from 'vitest'
import {
  parseDsn,
  reportError,
  setMonitoringForTests,
  stackFrames,
} from '#/server/monitoring'

const DSN = 'https://abc123@o42.ingest.de.sentry.io/7'

afterEach(() => setMonitoringForTests({ fetch: fetch, dsn: undefined }))

describe('monitoring (Sentry envelope)', () => {
  it('Should read the EU ingest endpoint and key from the DSN', () => {
    expect(parseDsn(DSN)).toEqual({
      endpoint: 'https://o42.ingest.de.sentry.io/api/7/envelope/',
      publicKey: 'abc123',
      dsn: DSN,
    })
    expect(parseDsn('')).toBeNull()
    expect(parseDsn('not a url')).toBeNull()
    expect(parseDsn('https://o42.ingest.de.sentry.io/7')).toBeNull()
  })

  it('Should turn a V8 stack into frames, oldest first', () => {
    const frames = stackFrames(
      [
        'Error: boom',
        '    at charge (/app/server/billing.js:10:5)',
        '    at async run (/app/node_modules/hono/dist/x.js:3:1)',
      ].join('\n'),
    )
    expect(frames).toEqual([
      {
        function: 'async run',
        filename: '/app/node_modules/hono/dist/x.js',
        lineno: 3,
        colno: 1,
        in_app: false,
      },
      {
        function: 'charge',
        filename: '/app/server/billing.js',
        lineno: 10,
        colno: 5,
        in_app: true,
      },
    ])
  })

  it('Should send one envelope with the error and no personal request data', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    setMonitoringForTests({
      dsn: DSN,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(null, { status: 200 })
      }) as unknown as typeof fetch,
    })
    await reportError(new TypeError('price missing'), {
      traceId: 't-1',
      method: 'POST',
      path: '/api/v1/stripe/webhook',
      userId: 'user-1',
      tags: { area: 'stripe-webhook' },
    })

    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]!
    expect(url).toBe('https://o42.ingest.de.sentry.io/api/7/envelope/')
    expect((init.headers as Record<string, string>)['X-Sentry-Auth']).toContain(
      'sentry_key=abc123',
    )
    const [header, item, raw] = String(init.body).split('\n')
    expect(JSON.parse(header!)).toMatchObject({ dsn: DSN })
    expect(JSON.parse(item!)).toEqual({ type: 'event' })
    const event = JSON.parse(raw!)
    expect(event.exception.values[0]).toMatchObject({
      type: 'TypeError',
      value: 'price missing',
    })
    expect(event.request).toEqual({
      method: 'POST',
      url: '/api/v1/stripe/webhook',
    })
    expect(event.user).toEqual({ id: 'user-1' })
    expect(event.tags).toEqual({ trace_id: 't-1', area: 'stripe-webhook' })
    expect(raw).not.toMatch(/ip_address|cookie|authorization/i)
  })

  it('Should do nothing without a DSN and never throw when Sentry is down', async () => {
    let called = 0
    setMonitoringForTests({
      dsn: null,
      fetch: async () => {
        called++
        return new Response(null)
      },
    })
    await reportError(new Error('x'))
    expect(called).toBe(0)

    setMonitoringForTests({
      dsn: DSN,
      fetch: async () => {
        throw new Error('network down')
      },
    })
    await expect(reportError(new Error('x'))).resolves.toBeUndefined()
  })
})
