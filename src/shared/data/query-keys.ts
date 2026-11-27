import type { QueryKey } from '@tanstack/react-query'

/** Klucze zapytań — jedno źródło, żeby mutacje unieważniały właściwe dane. */
export const keys = {
  me: ['me'],
  settings: ['settings'],
  scale: ['sp-scale'],
  taskTypes: ['task-types'],
  statuses: ['task-statuses'],
  cadence: ['sprint-cadence'],
  sprints: ['sprints'],
  projects: ['projects'],
  tags: ['tags'],
  templates: ['quick-templates'],
  daysOff: ['days-off'],
  security: ['security'],
  sessions: ['sessions'],
  invoices: ['invoices'],
} as const satisfies Record<string, QueryKey>
