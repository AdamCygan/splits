import { z } from '#/lib/zod'
import { dateSchema, idSchema } from '#/shared/data/dto'

/** Kontrakt API (sprints): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface SprintCadence {
  lengthDays: number
  anchorDate: string
  namePattern: string
  autoCreate: boolean
}

export interface Sprint {
  id: string
  number: number | null
  name: string
  goal: string | null
  startsOn: string
  endsOn: string
  capacityStoryPoints: number | null
  fromCadence: boolean
  /** Ile czasu chcesz poświęcić w sprincie na dany rodzaj pracy (np. Code Review 6h). */
  timeGoals: Array<SprintTimeGoal>
}

export interface SprintTimeGoal {
  taskTypeId: string
  minutes: number
}

export type SprintInput = Pick<
  Sprint,
  'name' | 'goal' | 'startsOn' | 'endsOn' | 'capacityStoryPoints' | 'timeGoals'
>

export const cadenceSchema = z
  .object({
    lengthDays: z.number().int(),
    anchorDate: dateSchema,
    namePattern: z.string(),
    autoCreate: z.boolean(),
  })
  .nullable()

export const sprintSchema = z.object({
  id: idSchema,
  number: z.number().int().nullable(),
  name: z.string(),
  goal: z.string().nullable(),
  startsOn: dateSchema,
  endsOn: dateSchema,
  capacityStoryPoints: z.number().nullable(),
  timeGoals: z
    .array(z.object({ taskTypeId: z.string(), minutes: z.number() }))
    .default([]),
  fromCadence: z.boolean(),
})
