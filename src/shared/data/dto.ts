import { z } from '#/lib/zod'

/** Schematy odpowiedzi API — dane z sieci są walidowane, a nie rzutowane na ślepo. */
export const idSchema = z.string()

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const requirementSchema = z.enum(['hidden', 'optional', 'required'])

export const workKindSchema = z.enum([
  'task',
  'code_review',
  'pair_programming',
  'additional_work',
  'meeting',
  'custom',
])
