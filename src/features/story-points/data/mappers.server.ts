import type { SpScaleStep } from '#/features/story-points/data/dto'
import type * as t from '#/server/db/schema'

export const toScaleStep = (
  s: typeof t.storyPointScale.$inferSelect,
): SpScaleStep => ({ id: s.id, points: s.points, maxMinutes: s.maxMinutes })
