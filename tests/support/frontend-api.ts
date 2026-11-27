import { accountApi } from '#/features/account/data/api'
import { adminApi } from '#/features/admin/data/api'
import { appApi } from '#/features/app/data/api'
import { authApi } from '#/features/auth/data/api'
import { billingApi } from '#/features/billing/data/api'
import { breaksApi } from '#/features/breaks/data/api'
import { daysOffApi } from '#/features/days-off/data/api'
import { projectsApi } from '#/features/projects/data/api'
import { settingsApi } from '#/features/settings/data/api'
import { sprintsApi } from '#/features/sprints/data/api'
import { spScaleApi } from '#/features/story-points/data/api'
import { tagsApi } from '#/features/tags/data/api'
import { statusesApi } from '#/features/task-statuses/data/api'
import { taskTypesApi } from '#/features/task-types/data/api'
import { templatesApi } from '#/features/templates/data/api'
import { entriesApi } from '#/features/time-entries/data/api'

/** Klienci API wszystkich funkcji w jednym obiekcie (test kontraktu frontend ↔ serwer). */
export const frontendApi = {
  ...appApi,
  auth: authApi,
  account: accountApi,
  settings: settingsApi,
  spScale: spScaleApi,
  taskTypes: taskTypesApi,
  statuses: statusesApi,
  breaks: breaksApi,
  daysOff: daysOffApi,
  sprints: sprintsApi,
  projects: projectsApi,
  tags: tagsApi,
  entries: entriesApi,
  templates: templatesApi,
  billing: billingApi,
  admin: adminApi,
}
