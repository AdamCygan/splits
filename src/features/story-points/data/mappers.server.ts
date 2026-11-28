import type { SpScaleStep } from '#/features/story-points/data/dto'
import type * as schema from '#/server/db/schema'

export const toScaleStep = (
  storyPointScaleRow: typeof schema.storyPointScale.$inferSelect,
): SpScaleStep => ({
  id: storyPointScaleRow.id,
  points: storyPointScaleRow.points,
  maxMinutes: storyPointScaleRow.maxMinutes,
})
