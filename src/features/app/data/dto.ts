import { userSchema } from '#/features/auth/data/dto'
import type { User } from '#/features/auth/data/dto'
import { projectSchema } from '#/features/projects/data/dto'
import type { Project } from '#/features/projects/data/dto'
import { settingsSchema } from '#/features/settings/data/dto'
import type { UserSettings } from '#/features/settings/data/dto'
import { scaleSchema } from '#/features/story-points/data/dto'
import type { SpScaleStep } from '#/features/story-points/data/dto'
import { taskTypeSchema } from '#/features/task-types/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import { templateSchema } from '#/features/templates/data/dto'
import type { QuickTemplate } from '#/features/templates/data/dto'
import { timeEntrySchema } from '#/features/time-entries/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { z } from '#/lib/zod'
import { dateSchema } from '#/shared/data/dto'

/** Kontrakt API (app): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

/** Start panelu jednym żądaniem (GET /bootstrap): konto, konfiguracja i dzisiejszy dzień. */
export interface Bootstrap {
  user: User
  settings: UserSettings
  taskTypes: Array<TaskType>
  scale: Array<SpScaleStep>
  projects: Array<Project>
  templates: Array<QuickTemplate>
  /** „Dziś” w strefie użytkownika (YYYY-MM-DD). */
  today: string
  entries: Array<TimeEntry>
  paused: Array<TimeEntry>
  running: TimeEntry | null
}

export const bootstrapSchema = z.object({
  user: userSchema,
  settings: settingsSchema,
  taskTypes: z.array(taskTypeSchema),
  scale: scaleSchema,
  projects: z.array(projectSchema),
  templates: z.array(templateSchema),
  today: dateSchema,
  entries: z.array(timeEntrySchema),
  paused: z.array(timeEntrySchema),
  running: timeEntrySchema.nullable(),
})
