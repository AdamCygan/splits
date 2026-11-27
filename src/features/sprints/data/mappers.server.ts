import type { Sprint, SprintCadence } from '#/features/sprints/data/dto'
import type * as t from '#/server/db/schema'

export const toCadence = (
  x: typeof t.sprintCadences.$inferSelect | undefined,
): SprintCadence | null =>
  x
    ? {
        lengthDays: x.lengthDays,
        anchorDate: x.anchorDate,
        namePattern: x.namePattern,
        autoCreate: x.autoCreate,
      }
    : null

export const toSprint = (x: typeof t.sprints.$inferSelect): Sprint => ({
  id: x.id,
  number: x.number,
  name: x.name,
  goal: x.goal,
  startsOn: x.startsOn,
  endsOn: x.endsOn,
  capacityStoryPoints: x.capacityStoryPoints,
  timeGoals: x.timeGoals,
  fromCadence: x.fromCadence,
})
