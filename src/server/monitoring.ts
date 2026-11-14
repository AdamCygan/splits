/**
 * Zgłaszanie błędów serwera do Sentry bez SDK: jedno żądanie HTTP (Envelope API) na błąd.
 * Bez SENTRY_DSN nic nie wysyłamy, błąd zostaje tylko w logach.
 *
 * Wysyłamy wyłącznie: typ i treść błędu, stos wywołań, metodę i ścieżkę żądania (bez query),
 * identyfikator śledzenia i id użytkownika. Nigdy treści żądań, nagłówków, ciasteczek ani adresu IP.
 */
import { randomUUID } from 'node:crypto'
import { serverEnv } from './env'

type Dsn = { endpoint: string; publicKey: string; dsn: string }

export function parseDsn(dsn: string | null): Dsn | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\/|\/$/g, '')
    if (!url.username || !projectId) return null
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
      dsn,
    }
  } catch {
    return null
  }
}

type Frame = {
  function?: string
  filename?: string
  lineno?: number
  colno?: number
  in_app: boolean
}

/** Ramki stosu V8 („at fn (plik:linia:kolumna)”), od najstarszej, jak oczekuje Sentry. */
export function stackFrames(stack: string | undefined): Array<Frame> {
  if (!stack) return []
  const frames: Array<Frame> = []
  for (const line of stack.split('\n').slice(1)) {
    const match =
      /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line) ??
      /^\s*at (.+)$/.exec(line)
    if (!match) continue
    const [, fn, file, lineno, colno] = match
    frames.push({
      function: fn,
      filename: file,
      lineno: lineno ? Number(lineno) : undefined,
      colno: colno ? Number(colno) : undefined,
      in_app:
        !!file && !file.includes('node_modules') && !file.startsWith('node:'),
    })
  }
  return frames.reverse()
}

export type ErrorContext = {
  traceId?: string
  method?: string
  path?: string
  userId?: string
  /** Dodatkowe znaczniki do filtrowania w Sentry, np. { area: 'stripe-webhook' }. */
  tags?: Record<string, string>
  level?: 'error' | 'warning'
}

let fetcher: typeof fetch = (...args) => fetch(...args)
let dsnOverride: string | null | undefined

/** Tylko testy: własny fetch i DSN. */
export function setMonitoringForTests(options: {
  fetch?: typeof fetch
  dsn?: string | null
}) {
  if (options.fetch) fetcher = options.fetch
  dsnOverride = options.dsn
}

export function buildEvent(error: unknown, context: ErrorContext = {}) {
  const err =
    error instanceof Error ? error : new Error(String(error ?? 'Unknown error'))
  return {
    event_id: randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: context.level ?? 'error',
    environment: serverEnv.isProduction ? 'production' : 'development',
    ...(serverEnv.release ? { release: serverEnv.release } : {}),
    server_name: process.env.FLY_MACHINE_ID ?? undefined,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: { frames: stackFrames(err.stack) },
        },
      ],
    },
    ...(context.method && context.path
      ? { request: { method: context.method, url: context.path } }
      : {}),
    ...(context.userId ? { user: { id: context.userId } } : {}),
    tags: {
      ...(context.traceId ? { trace_id: context.traceId } : {}),
      ...context.tags,
    },
  }
}

/**
 * Zgłasza błąd (log zawsze, Sentry gdy skonfigurowany). Nigdy nie rzuca i nie blokuje odpowiedzi
 * na dłużej niż 3 s; błąd wysyłki ląduje tylko w logach.
 */
export async function reportError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  const target = parseDsn(
    dsnOverride === undefined ? serverEnv.sentryDsn : dsnOverride,
  )
  if (!target) return
  const event = buildEvent(error, context)
  const body = [
    JSON.stringify({
      event_id: event.event_id,
      dsn: target.dsn,
      sent_at: new Date().toISOString(),
    }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')
  try {
    const res = await fetcher(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=pointhours/1.0, sentry_key=${target.publicKey}`,
      },
      body,
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok)
      console.error(`[monitoring] Sentry odrzucił zgłoszenie: ${res.status}`)
  } catch (sendError) {
    console.error('[monitoring] nie udało się wysłać zgłoszenia', sendError)
  }
}

let processHooks = false

/** Błędy poza żądaniami (np. nieobsłużone obietnice) też trafiają do Sentry. */
export function installProcessHandlers() {
  if (processHooks) return
  processHooks = true
  process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandledRejection', reason)
    void reportError(reason, { tags: { area: 'process' } })
  })
}
