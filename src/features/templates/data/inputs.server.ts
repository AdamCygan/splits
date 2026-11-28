import { LIMITS } from '#/features/task-types/domain/rules'
import { storyPoints, time, trimmed, uuid } from '#/server/http/inputs'
import { z } from 'zod'

export const templateInput = z
  .object({
    taskTypeId: uuid,
    projectId: uuid.nullable(),
    askProject: z.boolean().default(false),
    label: trimmed(1, LIMITS.templateLabel),
    title: trimmed(1, LIMITS.templateTitle),
    storyPoints: storyPoints.nullable(),
    defaultDurationMinutes: z
      .number()
      .int()
      .min(LIMITS.templateDuration.min)
      .max(LIMITS.templateDuration.max)
      .nullable(),
    hotkey: z.number().int().min(1).max(9).nullable(),
    schedule: z
      .array(z.object({ day: z.number().int().min(0).max(6), time }))
      .max(7)
      .default([])
      .refine(
        (list) => new Set(list.map((slot) => slot.day)).size === list.length,
      ),
  })
  // Powtarzane spotkanie wpisuje się od razu z godzinami, więc potrzebuje czasu trwania.
  .refine(
    (template) =>
      template.schedule.length === 0 ||
      template.defaultDurationMinutes !== null,
    {
      path: ['schedule'],
    },
  )
  // Szablon „dowolny projekt” nie trzyma projektu: wybór pada przy użyciu.
  .transform((template) => ({
    ...(template.askProject ? { ...template, projectId: null } : template),
    schedule: [...template.schedule].sort(
      (left, right) => left.day - right.day,
    ),
  }))
