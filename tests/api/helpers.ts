import { api } from '#/server/app'
import { outbox } from '#/server/email'

export interface ApiResponse<TBody> {
  status: number
  body: TBody
  headers: Headers
}

/** Klient testowy: woła aplikację Hono bez serwera HTTP i pamięta ciasteczka jak przeglądarka. */
export function client() {
  const cookies = new Map<string, string>()
  let token: string | null = null

  async function call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    // __raw: ciało wysyłane dosłownie (np. podpisany webhook Stripe).
    const { __raw: raw, ...extra } = headers
    headers = extra
    const response = await api.request(`http://localhost:3000/api/v1${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookies.size
          ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
          : {}),
        Origin: 'http://localhost:3000',
        ...headers,
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const [name, ...rest] = pair!.split('=')
      const value = rest.join('=')
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line) || value === '')
        cookies.delete(name!)
      else cookies.set(name!, value)
    }
    const text = await response.text()
    const parsed = (text ? JSON.parse(text) : undefined) as T
    if (
      parsed &&
      typeof parsed === 'object' &&
      'accessToken' in parsed &&
      typeof parsed.accessToken === 'string'
    )
      token = parsed.accessToken
    return { status: response.status, body: parsed, headers: response.headers }
  }

  return {
    get: <T = unknown>(path: string) => call<T>('GET', path),
    post: <T = unknown>(
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
    ) => call<T>('POST', path, body, headers),
    put: <T = unknown>(path: string, body?: unknown) =>
      call<T>('PUT', path, body),
    del: <T = unknown>(path: string, body?: unknown) =>
      call<T>('DELETE', path, body),
    patch: <T = unknown>(path: string, body?: unknown) =>
      call<T>('PATCH', path, body),
    cookies,
    setToken: (value: string | null) => {
      token = value
    },
  }
}

export type ApiClient = ReturnType<typeof client>

let n = 0
export interface RegisteredOptions {
  verify?: boolean
}

export async function registered(
  locale: 'en' | 'pl' = 'en',
  { verify = true }: RegisteredOptions = {},
) {
  const c = client()
  const id = `${Date.now().toString(36)}${n++}`
  const res = await c.post('/auth/register', {
    username: `user${id}`,
    email: `user${id}@example.com`,
    password: 'correct horse 42',
    locale,
    timezone: 'Europe/Warsaw',
  })
  if (res.status !== 201) throw new Error(`register failed ${res.status}`)
  // Jak prawdziwy użytkownik: link z e-maila potwierdza adres (zakupy tego wymagają).
  if (verify)
    await c.post('/auth/email/confirm', {
      token: lastToken(`user${id}@example.com`),
    })
  return { c, username: `user${id}`, email: `user${id}@example.com` }
}

/** Token z ostatniego linku wysłanego na adres (z lokalnej skrzynki e-maili). */
export function lastToken(to: string): string {
  const mail = [...outbox]
    .reverse()
    .find((m) => m.to === to && /token=/.test(m.text))
  if (!mail) throw new Error(`no email with a link for ${to}`)
  return /token=([\w-]+)/.exec(mail.text)![1]!
}

/** Kod usunięcia konta z ostatniego e-maila na adres (6 cyfr w osobnej linii). */
export function lastDeleteCode(to: string): string {
  const mail = [...outbox]
    .reverse()
    .find((m) => m.to === to && /delete/i.test(m.subject))
  const code = mail && /^(\d{6})$/m.exec(mail.text)?.[1]
  if (!code) throw new Error(`no delete code for ${to}`)
  return code
}

/** Inny poprawny kod niż podany (do sprawdzania odrzucenia złego kodu). */
export const otherCode = (code: string) =>
  String((Number(code) + 1) % 1_000_000).padStart(6, '0')

export async function sample() {
  const c = client()
  const res = await c.post('/test/sample-account', {
    timezone: 'Europe/Warsaw',
  })
  if (res.status !== 201) throw new Error(`sample failed ${res.status}`)
  return c
}

export { inSequence, numbered } from '../support/sequence'
