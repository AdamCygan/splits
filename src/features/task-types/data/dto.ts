import type { WorkKind } from '#/features/task-types/domain/work-types'
import type { TimeInputMode } from '#/features/settings/data/dto'
import { z } from '#/lib/zod'
import { idSchema, requirementSchema, workKindSchema } from '#/shared/data/dto'

/** Kontrakt API (task-types): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export type FieldRequirement = 'hidden' | 'optional' | 'required'

export interface TaskType {
  id: string
  kind: WorkKind
  name: string
  color: string
  isSystem: boolean
  titleLabel: string
  linkRequirement: FieldRequirement
  linkLabel: string
  descriptionRequirement: FieldRequirement
  /** Czy wpis tego typu ma story pointy: wymagane (zadania), opcjonalne (CR, pair) albo wcale (spotkania). */
  storyPointsRequirement: FieldRequirement
  /** Wartość zaznaczona w formularzu; null = domyślnie bez SP (tylko gdy SP nie są wymagane). */
  defaultStoryPoints: number | null
  defaultTimeInput: TimeInputMode
  countsAsFocusWork: boolean
  sortOrder: number
  archivedAt: string | null
}

// ---------- Dane wejściowe (create/update) ----------

export type TaskTypeInput = Omit<
  TaskType,
  'id' | 'kind' | 'isSystem' | 'sortOrder' | 'archivedAt'
>

export const taskTypeSchema = z.object({
  id: idSchema,
  kind: workKindSchema,
  name: z.string(),
  color: z.string(),
  isSystem: z.boolean(),
  titleLabel: z.string(),
  linkRequirement: requirementSchema,
  linkLabel: z.string(),
  descriptionRequirement: requirementSchema,
  storyPointsRequirement: requirementSchema,
  defaultStoryPoints: z.number().nullable(),
  defaultTimeInput: z.enum(['range', 'duration']),
  countsAsFocusWork: z.boolean(),
  sortOrder: z.number().int(),
  archivedAt: z.string().nullable(),
})
