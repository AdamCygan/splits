import { api } from '#/server/app'
import { sql } from 'drizzle-orm'
import { database } from '#/server/db/client'
import { users } from '#/server/db/schema'
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
          ? {
              Cookie: [...cookies]
                .map(([key, value]) => `${key}=${value}`)
                .join('; '),
            }
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
      const isCleared =
        /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line) || value === ''
      if (isCleared) cookies.delete(name!)
      else cookies.set(name!, value)
    }
    const text = await response.text()
    const parsed = (text ? JSON.parse(text) : undefined) as T
    const accessToken = readAccessToken(parsed)
    if (accessToken) token = accessToken
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

let count = 0
export interface RegisteredOptions {
  verify?: boolean
  /** Konto Pro (bez limitów planu Free), gdy test sprawdza coś innego niż limity. */
  pro?: boolean
}

export async function registered(
  locale: 'en' | 'pl' = 'en',
  { verify = true, pro = false }: RegisteredOptions = {},
) {
  const apiClient = client()
  const id = `${Date.now().toString(36)}${count++}`
  const response = await apiClient.post('/auth/register', {
    username: `user${id}`,
    email: `user${id}@example.com`,
    password: 'correct horse 42',
    locale,
    timezone: 'Europe/Warsaw',
  })
  const isNotCreated = response.status !== 201
  if (isNotCreated) throw new Error(`register failed ${response.status}`)
  // Jak prawdziwy użytkownik: link z e-maila potwierdza adres (zakupy tego wymagają).
  if (verify)
    await apiClient.post('/auth/email/confirm', {
      token: lastToken(`user${id}@example.com`),
    })
  if (pro)
    await database
      .update(users)
      .set({ plan: 'pro' })
      .where(sql`lower(${users.email}) = ${`user${id}@example.com`}`)
  return { apiClient, username: `user${id}`, email: `user${id}@example.com` }
}

/** Konto z rolą administratora (zarejestrowane i potwierdzone jak każde inne). */
export async function registeredAdmin() {
  const account = await registered()
  await database
    .update(users)
    .set({ role: 'admin' })
    .where(sql`lower(${users.email}) = ${account.email}`)
  return account
}

/** Token z ostatniego linku wysłanego na adres (z lokalnej skrzynki e-maili). */
export function lastToken(to: string): string {
  const mail = [...outbox]
    .reverse()
    .find((email) => email.to === to && /token=/.test(email.text))
  if (!mail) throw new Error(`no email with a link for ${to}`)
  return /token=([\w-]+)/.exec(mail.text)![1]!
}

/** Kod usunięcia konta z ostatniego e-maila na adres (6 cyfr w osobnej linii). */
export function lastDeleteCode(to: string): string {
  const mail = [...outbox]
    .reverse()
    .find((email) => email.to === to && /delete/i.test(email.subject))
  const code = mail && /^(\d{6})$/m.exec(mail.text)?.[1]
  if (!code) throw new Error(`no delete code for ${to}`)
  return code
}

/** Inny poprawny kod niż podany (do sprawdzania odrzucenia złego kodu). */
export const otherCode = (code: string) =>
  String((Number(code) + 1) % 1_000_000).padStart(6, '0')

export async function sample() {
  const apiClient = client()
  const response = await apiClient.post('/test/sample-account', {
    timezone: 'Europe/Warsaw',
  })
  const isNotCreated = response.status !== 201
  if (isNotCreated) throw new Error(`sample failed ${response.status}`)
  return apiClient
}

export { inSequence, numbered } from '../support/sequence'

/** Token z odpowiedzi logowania albo odświeżenia (inne odpowiedzi go nie mają). */
function readAccessToken(parsed: unknown) {
  const isObject = typeof parsed === 'object' && parsed !== null
  if (!isObject) return null
  const accessToken: unknown = Reflect.get(parsed, 'accessToken')
  const isToken = typeof accessToken === 'string'
  return isToken ? accessToken : null
}
