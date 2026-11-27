import type { User } from '#/features/auth/data/dto'
import type * as t from '#/server/db/schema'

export const toUser = (u: typeof t.users.$inferSelect): User => ({
  id: u.id,
  username: u.username,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  plan: u.plan,
  hasPassword: u.passwordHash !== null,
  isDemo: u.isDemo,
  emailVerified: u.emailVerifiedAt !== null || u.isDemo,
})
