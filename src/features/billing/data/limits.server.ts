import { hasProAccess } from '#/features/billing/domain/plans'
import { currentUser } from '#/features/account/data/repository.server'
import { ApiError } from '#/server/http/errors'

type FreeLimitCode =
  'plan.limit_projects' | 'plan.limit_templates' | 'plan.limit_statuses'

/**
 * Limit planu Free na liczbę elementów (projekty, szablony, statusy). Liczy się stan przed
 * dodaniem albo przywróceniem z archiwum; Pro i administrator nie mają limitu.
 */
export async function assertFreeSlot(
  userId: string,
  count: () => Promise<number>,
  limit: number,
  code: FreeLimitCode,
) {
  const user = await currentUser(userId)
  if (!hasProAccess(user) && (await count()) >= limit)
    throw new ApiError(code, 403)
}
