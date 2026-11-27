import {
  adminStatsSchema,
  adminUserPageSchema,
  adminUserSchema,
  adminUserDetailSchema,
  adminActionPageSchema,
} from './dto'
import type {
  AdminActionFilter,
  AdminActionPage,
  AdminStats,
  AdminUser,
  AdminUserChange,
  AdminUserDetail,
  AdminUserFilter,
  AdminUserPage,
} from './dto'
import { invoiceSchema } from '#/features/billing/data/dto'
import type { Invoice } from '#/features/billing/data/dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send, queryString } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

/** Panel administratora: tylko dla roli „admin” (serwer sprawdza ją przy każdym żądaniu). */
export interface AdminApi {
  stats: () => R<AdminStats>
  users: (filter: AdminUserFilter) => R<AdminUserPage>
  /** Wszystkie konta z filtrami (eksport CSV; serwer zapisuje go w dzienniku). */
  exportUsers: (filter: AdminUserFilter) => R<Array<AdminUser>>
  user: (id: string) => R<AdminUserDetail>
  updateUser: (id: string, change: AdminUserChange) => R<AdminUser>
  revokeSessions: (id: string) => R<undefined>
  revokeSession: (id: string, sessionId: string) => R<undefined>
  resendVerification: (id: string) => R<undefined>
  cancelEmailChange: (id: string) => R<undefined>
  /** Wyłączenie 2FA po utracie telefonu; powód (jak sprawdzono tożsamość) do dziennika. */
  disableTwoFactor: (id: string, reason: string) => R<undefined>
  invoices: (id: string) => R<Array<Invoice>>
  /** Usunięcie konta; `confirmEmail` musi być adresem tego konta. */
  deleteUser: (id: string, confirmEmail: string) => R<undefined>
  actions: (filter: AdminActionFilter) => R<AdminActionPage>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const adminApi: AdminApi = {
  stats: () => get('/admin/stats', adminStatsSchema),
  users: (filter) =>
    get(
      `/admin/users${queryString({ ...filter, page: filter.page && filter.page > 1 ? filter.page : undefined })}`,
      adminUserPageSchema,
    ),
  exportUsers: (filter) =>
    get(
      `/admin/users/export${queryString({ ...filter, page: undefined })}`,
      z.array(adminUserSchema),
    ),
  user: (id) => get(`/admin/users/${id}`, adminUserDetailSchema),
  updateUser: (id, change) =>
    send('PATCH', `/admin/users/${id}`, adminUserSchema, change),
  revokeSessions: (id) =>
    send('POST', `/admin/users/${id}/revoke-sessions`, emptyResponse),
  revokeSession: (id, sessionId) =>
    send('DELETE', `/admin/users/${id}/sessions/${sessionId}`, emptyResponse),
  resendVerification: (id) =>
    send('POST', `/admin/users/${id}/email/verify`, emptyResponse),
  cancelEmailChange: (id) =>
    send('DELETE', `/admin/users/${id}/email/pending`, emptyResponse),
  disableTwoFactor: (id, reason) =>
    send('POST', `/admin/users/${id}/2fa/disable`, emptyResponse, { reason }),
  invoices: (id) => get(`/admin/users/${id}/invoices`, z.array(invoiceSchema)),
  deleteUser: (id, confirmEmail) =>
    send('DELETE', `/admin/users/${id}`, emptyResponse, { confirmEmail }),
  actions: (filter) =>
    get(
      `/admin/actions${queryString({ ...filter, page: filter.page && filter.page > 1 ? filter.page : undefined })}`,
      adminActionPageSchema,
    ),
}
