import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'
import {
  APPLY_KINDS,
  APPLY_PREFERENCES,
} from '#/features/workspaces/domain/workspaces'
import type {
  ApplyPreferences,
  ApplyTarget,
  CopyKind,
} from '#/features/workspaces/domain/workspaces'

/** Kontrakt API (workspaces): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface Workspace {
  id: string
  name: string
  color: string
}

export interface WorkspacePrefs {
  /** Gdzie trafiają zmiany dni wolnych, sprintów, rodzajów pracy… ('ask' = pytaj). */
  apply: ApplyPreferences
  /** Ekran „W czym dziś pracujesz?” przy pierwszym wejściu danego dnia. */
  askDaily: boolean
}

export interface WorkspaceState {
  /** Bieżąca przestrzeń tej przeglądarki. */
  current: string
  /** W kolejności z ustawień (skróty Alt+Shift+1…9 idą po tej kolejności). */
  items: Array<Workspace>
  prefs: WorkspacePrefs
}

export type WorkspaceInput = Pick<Workspace, 'name' | 'color'>

export interface WorkspaceCreateInput extends WorkspaceInput {
  /** Przestrzeń, z której kopiujemy wybrane rzeczy; null = start z ustawień domyślnych. */
  copyFrom: string | null
  copy: Array<CopyKind>
}

export interface WorkspaceCopyInput {
  from: string
  copy: Array<CopyKind>
}

/** Dodatek do zmian, które można zastosować w kilku przestrzeniach. */
export interface ApplyOption {
  applyTo?: ApplyTarget
}

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: z.string(),
})

const preferenceSchema = z.enum(APPLY_PREFERENCES)

export const workspacePrefsSchema = z.object({
  apply: z.partialRecord(z.enum(APPLY_KINDS), preferenceSchema),
  askDaily: z.boolean(),
})

export const workspaceStateSchema = z.object({
  current: idSchema,
  items: z.array(workspaceSchema),
  prefs: workspacePrefsSchema,
})
