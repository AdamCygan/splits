/**
 * Zgłaszanie błędów serwera do Sentry bez SDK: jedno żądanie HTTP (Envelope API) na błąd.
 * Bez SENTRY_DSN nic nie wysyłamy, błąd zostaje tylko w logach.
 *
 * Wysyłamy wyłącznie: typ i treść błędu, stos wywołań, metodę i ścieżkę żądania (bez query),
 * identyfikator śledzenia i id użytkownika. Nigdy treści żądań, nagłówków, ciasteczek ani adresu IP.
 */
import { randomUUID } from 'node:crypto'
import { serverEnv } from './env'

interface Dsn {
  endpoint: string
  publicKey: string
  dsn: string
}

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

interface Frame {
  function?: string
  filename?: string
  lineno?: number
  colno?: number
  in_app: boolean
}

const POSITION_RE = /:(\d+):(\d+)$/

/**
 * Jedna ramka „at fn (plik:linia:kolumna)” albo „at plik:linia:kolumna”. Bez jednego
 * wyrażenia regularnego na całą linię: takie z dwoma leniwymi grupami ma wielomianowy
 * backtracking (ReDoS), a linia z komunikatu błędu może pochodzić od użytkownika.
 */
function parseFrame(line: string): Frame | null {
  const text = line.trim()
  if (!text.startsWith('at ')) return null
  const rest = text.slice(3)
  const open = rest.endsWith(')') ? rest.lastIndexOf(' (') : -1
  const location = open >= 0 ? rest.slice(open + 2, -1) : rest
  const position = POSITION_RE.exec(location)
  if (!position) return { function: rest, in_app: false }
  const file = location.slice(0, position.index)
  return {
    function: open >= 0 ? rest.slice(0, open) : undefined,
    filename: file,
    lineno: Number(position[1]),
    colno: Number(position[2]),
    in_app: !file.includes('node_modules') && !file.startsWith('node:'),
  }
}

/** Ramki stosu V8 („at fn (plik:linia:kolumna)”), od najstarszej, jak oczekuje Sentry. */
export function stackFrames(stack: string | undefined): Array<Frame> {
  if (!stack) return []
  return stack
    .split('\n')
    .slice(1)
    .map(parseFrame)
    .filter((frame): frame is Frame => frame !== null)
    .reverse()
}

export interface ErrorContext {
  traceId?: string
  method?: string
  path?: string
  userId?: string
  /** Dodatkowe znaczniki do filtrowania w Sentry, np. { area: 'stripe-webhook' }. */
  tags?: Record<string, string>
  level?: 'error' | 'warning'
}

let fetcher: typeof fetch = (...callArguments) => fetch(...callArguments)
let dsnOverride: string | null | undefined

export interface MonitoringTestOptions {
  fetch?: typeof fetch
  dsn?: string | null
}

/** Tylko testy: własny fetch i DSN. */
export function setMonitoringForTests(options: MonitoringTestOptions) {
  if (options.fetch) fetcher = options.fetch
  dsnOverride = options.dsn
}

export function buildEvent(error: unknown, context: ErrorContext = {}) {
  const caughtError =
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
          type: caughtError.name,
          value: caughtError.message,
          stacktrace: { frames: stackFrames(caughtError.stack) },
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
    const response = await fetcher(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=timeblame/1.0, sentry_key=${target.publicKey}`,
      },
      body,
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok)
      console.error(
        `[monitoring] Sentry odrzucił zgłoszenie: ${response.status}`,
      )
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
