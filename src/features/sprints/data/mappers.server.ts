import type { Sprint, SprintCadence } from '#/features/sprints/data/dto'
import type * as schema from '#/server/db/schema'

export const toCadence = (
  sprintCadenceRow: typeof schema.sprintCadences.$inferSelect | undefined,
): SprintCadence | null =>
  sprintCadenceRow
    ? {
        lengthDays: sprintCadenceRow.lengthDays,
        anchorDate: sprintCadenceRow.anchorDate,
        namePattern: sprintCadenceRow.namePattern,
        autoCreate: sprintCadenceRow.autoCreate,
      }
    : null

export const toSprint = (
  sprintRow: typeof schema.sprints.$inferSelect,
): Sprint => ({
  id: sprintRow.id,
  number: sprintRow.number,
  name: sprintRow.name,
  goal: sprintRow.goal,
  startsOn: sprintRow.startsOn,
  endsOn: sprintRow.endsOn,
  capacityStoryPoints: sprintRow.capacityStoryPoints,
  timeGoals: sprintRow.timeGoals,
  fromCadence: sprintRow.fromCadence,
})
