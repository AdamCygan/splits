import { z } from 'zod'
import {
  APPLY_KINDS,
  APPLY_PREFERENCES,
  COPY_KINDS,
  WORKSPACE_NAME_MAX,
} from '#/features/workspaces/domain/workspaces'
import { color, trimmed, uuid } from '#/server/http/inputs'

export const workspaceInput = z.object({
  name: trimmed(1, WORKSPACE_NAME_MAX),
  color,
})

const copyKinds = z.array(z.enum(COPY_KINDS)).max(COPY_KINDS.length)

export const workspaceCreateInput = workspaceInput.extend({
  copyFrom: uuid.nullable().default(null),
  copy: copyKinds.default([]),
})

export const workspaceCopyInput = z.object({ from: uuid, copy: copyKinds })

export const currentInput = z.object({ id: uuid })

export const prefsInput = z.object({
  apply: z
    .partialRecord(z.enum(APPLY_KINDS), z.enum(APPLY_PREFERENCES))
    .optional(),
  askDaily: z.boolean().optional(),
})

/** Opcjonalne pole zmian, które mogą trafić do wszystkich przestrzeni. */
export const applyTo = z.enum(['this', 'all']).optional()
