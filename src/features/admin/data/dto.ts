import type {
  AdminActionKind,
  AdminUserSort,
  SortDir,
} from '#/features/admin/domain/admin'
import {
  activeSessionSchema,
  securityStatusSchema,
} from '#/features/account/data/dto'
import { planSchema } from '#/features/auth/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'
import { z } from '#/lib/zod'
import { dateSchema, idSchema } from '#/shared/data/dto'

/** Kontrakt API (admin): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

// ---------- Panel administratora ----------

export type AdminUser = z.infer<typeof adminUserSchema>

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>

export type AdminUserPage = z.infer<typeof adminUserPageSchema>

export type AdminStats = z.infer<typeof adminStatsSchema>

export type AdminAction = z.infer<typeof adminActionSchema>

export type AdminActionPage = z.infer<typeof adminActionPageSchema>

/** Filtry listy kont (te same w adresie strony, w API i w eksporcie CSV). */
export interface AdminUserFilter {
  q?: string
  plan?: PlanCode
  status?: 'active' | 'blocked' | 'demo'
  payment?: 'problem'
  email?: 'unverified'
  twoFactor?: 'on' | 'off'
  inactiveDays?: number
  sort?: AdminUserSort
  dir?: SortDir
  page?: number
}

export interface AdminUserChange {
  plan?: PlanCode
  role?: 'client' | 'admin'
  disabled?: boolean
}

/** Filtry dziennika zmian; `targetId` = historia jednego konta. */
export interface AdminActionFilter {
  admin?: string
  target?: string
  targetId?: string
  action?: AdminActionKind
  page?: number
}

export const adminUserSchema = z.object({
  id: idSchema,
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['client', 'manager', 'admin']),
  plan: planSchema,
  isDemo: z.boolean(),
  hasPassword: z.boolean(),
  emailVerified: z.boolean(),
  twoFactor: z.boolean().default(false),
  isOwner: z.boolean().default(false),
  disabledAt: z.string().nullable(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  lastActiveAt: z.string().nullable().default(null),
  entries: z.number().int(),
  lastEntryOn: z.string().nullable(),
  subscription: z
    .object({
      status: z.string(),
      plan: planSchema.default('pro'),
      active: z.boolean(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
})

export const adminUserDetailSchema = adminUserSchema.extend({
  security: securityStatusSchema,
  sessions: z.array(activeSessionSchema),
  billing: z.object({
    enabled: z.boolean(),
    stripeCustomerId: z.string().nullable(),
    stripeUrl: z.string().nullable(),
  }),
})

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

export const adminStatsSchema = z.object({
  users: z.number().int(),
  new7: z.number().int(),
  new30: z.number().int(),
  active7: z.number().int(),
  active30: z.number().int(),
  free: z.number().int(),
  pro: z.number().int(),
  lifetime: z.number().int(),
  blocked: z.number().int(),
  demo: z.number().int(),
  activeSubscriptions: z.number().int(),
  paymentProblems: z.number().int(),
  revenue: z.array(
    z.object({
      currency: z.string(),
      last30: z.number().int(),
      last365: z.number().int(),
      refunded365: z.number().int(),
    }),
  ),
  signups: z.array(z.object({ day: dateSchema, count: z.number().int() })),
  subscriptions: z
    .object({
      monthly: z.number().int(),
      yearly: z.number().int(),
      cancelling: z.number().int(),
    })
    .default({ monthly: 0, yearly: 0, cancelling: 0 }),
  mrr: z.number().int().default(0),
})

export const adminActionSchema = z.object({
  id: idSchema,
  adminEmail: z.string(),
  targetUserId: z.string().nullable(),
  targetEmail: z.string().nullable(),
  action: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
})

export const adminActionPageSchema = z.object({
  items: z.array(adminActionSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})
