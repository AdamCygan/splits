import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (templates): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface QuickTemplate {
  id: string
  taskTypeId: string
  projectId: string | null
  /** Dowolny projekt: przy użyciu szablonu aplikacja pyta, do którego projektu zapisać. */
  askProject: boolean
  label: string
  title: string
  storyPoints: number | null
  defaultDurationMinutes: number | null
  hotkey: number | null
  sortOrder: number
  /**
   * Powtarzanie (np. daily): dni tygodnia z godziną startu, każdy dzień może mieć swoją.
   * Pusta lista = szablon bez harmonogramu.
   */
  schedule: TemplateSchedule
}

/** Dzień tygodnia (0 = niedziela … 6 = sobota) i godzina startu 'HH:MM'. */
export type TemplateSchedule = Array<{ day: number; time: string }>

export type QuickTemplateInput = Omit<QuickTemplate, 'id' | 'sortOrder'>

export const templateSchema = z.object({
  id: idSchema,
  taskTypeId: idSchema,
  projectId: idSchema.nullable(),
  askProject: z.boolean().default(false),
  label: z.string(),
  title: z.string(),
  storyPoints: z.number().nullable(),
  defaultDurationMinutes: z.number().int().nullable(),
  hotkey: z.number().int().nullable(),
  sortOrder: z.number().int(),
  schedule: z
    .array(z.object({ day: z.number().int(), time: z.string() }))
    .default([]),
})
