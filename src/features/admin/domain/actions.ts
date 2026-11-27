import { ADMIN_ACTION_KINDS } from '#/features/admin/domain/admin'
import type { AdminActionKind } from '#/features/admin/domain/admin'

export const isKind = (action: string): action is AdminActionKind =>
  (ADMIN_ACTION_KINDS as ReadonlyArray<string>).includes(action)
