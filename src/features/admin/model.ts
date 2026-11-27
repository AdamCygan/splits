import { ADMIN_ACTION_KINDS, ADMIN_USER_SORTS } from '#/domain/admin'
import type { AdminActionKind, AdminUserSort, SortDir } from '#/domain/admin'
import type {
  AdminActionFilter,
  AdminUserFilter,
} from '#/features/admin/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'

export const PLANS: ReadonlyArray<PlanCode> = ['free', 'pro', 'lifetime']

const oneOf = <TValue extends string>(
  values: ReadonlyArray<TValue>,
  value: unknown,
): TValue | undefined =>
  values.includes(value as TValue) ? (value as TValue) : undefined

const text = (value: unknown) =>
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 100)
    : undefined

const positive = (value: unknown, max: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined
}

/**
 * Filtry listy kont z adresu strony (?q=…&plan=pro&sort=entries). Nieznane wartości
 * pomijamy, więc link wklejony z błędem otwiera po prostu szerszą listę.
 */
export function parseUserSearch(
  search: Record<string, unknown>,
): AdminUserFilter {
  const filter: AdminUserFilter = {
    q: text(search.q),
    plan: oneOf(['free', 'pro', 'lifetime'], search.plan),
    status: oneOf(['active', 'blocked', 'demo'], search.status),
    payment: oneOf(['problem'], search.payment),
    email: oneOf(['unverified'], search.email),
    twoFactor: oneOf(['on', 'off'], search.twoFactor),
    inactiveDays: positive(search.inactiveDays, 3650),
    sort: oneOf<AdminUserSort>(ADMIN_USER_SORTS, search.sort),
    dir: oneOf<SortDir>(['asc', 'desc'], search.dir),
    page: positive(search.page, 10_000),
  }
  return withoutEmpty(filter)
}

/** Filtry dziennika zmian z adresu strony (?action=user.blocked&admin=…). */
export function parseActionSearch(
  search: Record<string, unknown>,
): AdminActionFilter {
  return withoutEmpty({
    admin: text(search.admin),
    target: text(search.target),
    action: oneOf<AdminActionKind>(ADMIN_ACTION_KINDS, search.action),
    page: positive(search.page, 10_000),
  })
}

/** Obiekt bez pól undefined (czytelny adres i stabilny klucz zapytania). */
export function withoutEmpty<TValue extends object>(value: TValue): TValue {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== ''),
  ) as TValue
}

/** Ile filtrów (poza wyszukiwaniem, sortowaniem i stroną) zawęża listę. */
export const activeUserFilters = (filter: AdminUserFilter) =>
  (
    ['plan', 'status', 'payment', 'email', 'twoFactor', 'inactiveDays'] as const
  ).filter((key) => filter[key] !== undefined).length

/** Liczba stron listy (co najmniej jedna). */
export const pageCount = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / pageSize))
