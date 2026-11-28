import type { User } from '#/features/auth/data/dto'
import type * as schema from '#/server/db/schema'

export const toUser = (userRow: typeof schema.users.$inferSelect): User => ({
  id: userRow.id,
  username: userRow.username,
  email: userRow.email,
  displayName: userRow.displayName,
  role: userRow.role,
  plan: userRow.plan,
  hasPassword: userRow.passwordHash !== null,
  isDemo: userRow.isDemo,
  emailVerified: userRow.emailVerifiedAt !== null || userRow.isDemo,
})
