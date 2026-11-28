import { PRO_PRICES } from '#/features/billing/domain/plans'
import { toCsv } from '#/shared/domain/csv'

/** Rodzaje wpisów w dzienniku zmian panelu admina (filtr i opisy w panelu). */
export const ADMIN_ACTION_KINDS = [
  'plan.changed',
  'role.changed',
  'user.blocked',
  'user.unblocked',
  'sessions.revoked',
  'session.revoked',
  'email.verification_sent',
  'email.change_canceled',
  'two_factor.disabled',
  'invoices.viewed',
  'users.exported',
  'user.deleted',
  'feedback.updated',
  'feedback.replied',
] as const

export type AdminActionKind = (typeof ADMIN_ACTION_KINDS)[number]

/**
 * Miesięczny przychód cykliczny (MRR) w centach USD: subskrypcje miesięczne po pełnej cenie,
 * roczne rozłożone na 12 miesięcy. Cena katalogowa z VAT, bez rabatów i zwrotów.
 */
export const monthlyRecurring = (monthly: number, yearly: number) =>
  Math.round(
    monthly * PRO_PRICES.month * 100 + (yearly * PRO_PRICES.year * 100) / 12,
  )

/** Odsetek płacących kont (0–100, jedno miejsce po przecinku); 0 bez kont. */
export const conversionRate = (paid: number, users: number) =>
  users > 0 ? Math.round((paid / users) * 1000) / 10 : 0

/** Statusy Stripe z nieudaną płatnością, przy których subskrypcja jeszcze trwa. */
export const PAYMENT_PROBLEM_STATUSES = ['past_due', 'unpaid'] as const

export const isPaymentProblem = (status: string | null | undefined) =>
  (PAYMENT_PROBLEM_STATUSES as ReadonlyArray<string>).includes(status ?? '')

/** Kolumny, po których da się sortować listę kont. */
export const ADMIN_USER_SORTS = [
  'created',
  'name',
  'email',
  'plan',
  'lastLogin',
  'lastActive',
  'entries',
] as const

export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number]
export type SortDir = 'asc' | 'desc'

export interface AdminSortState {
  sort: AdminUserSort
  dir: SortDir
}

/** Klik w nagłówek: ta sama kolumna odwraca kierunek, nowa startuje od naturalnego (tekst A→Z, reszta malejąco). */
export function nextAdminSort(
  current: AdminSortState,
  sort: AdminUserSort,
): AdminSortState {
  if (current.sort === sort)
    return { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { sort, dir: sort === 'name' || sort === 'email' ? 'asc' : 'desc' }
}

/** Okresy bez aktywności do filtra „nieaktywni od …”. */
export const INACTIVE_DAY_OPTIONS = [7, 30, 90, 180, 365] as const

/** Wiersz eksportu listy kont (bez treści wpisów: tylko dane konta i liczniki). */
export interface AdminCsvUser {
  id: string
  username: string
  email: string
  displayName: string
  role: string
  plan: string
  isDemo: boolean
  disabledAt: string | null
  emailVerified: boolean
  twoFactor: boolean
  subscription: { status: string } | null
  createdAt: string
  lastLoginAt: string | null
  lastActiveAt: string | null
  entries: number
}

export const ADMIN_CSV_HEAD = [
  'id',
  'username',
  'email',
  'display_name',
  'role',
  'plan',
  'status',
  'email_verified',
  'two_factor',
  'subscription_status',
  'created_at',
  'last_login_at',
  'last_entry_at',
  'entries',
] as const

/** Lista kont jako CSV do arkusza (nagłówki po angielsku, daty w ISO 8601). */
export function adminUsersCsv(rows: ReadonlyArray<AdminCsvUser>) {
  return toCsv([
    ADMIN_CSV_HEAD,
    ...rows.map((u) => [
      u.id,
      u.username,
      u.email,
      u.displayName,
      u.role,
      u.plan,
      u.isDemo ? 'demo' : u.disabledAt ? 'blocked' : 'active',
      u.emailVerified,
      u.twoFactor,
      u.subscription?.status ?? null,
      u.createdAt,
      u.lastLoginAt,
      u.lastActiveAt,
      u.entries,
    ]),
  ])
}
