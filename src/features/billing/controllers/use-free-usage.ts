import { useQuery } from '@tanstack/react-query'
import { projectsQuery } from '#/features/projects/data/queries'
import { statusesQuery } from '#/features/task-statuses/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { templatesQuery } from '#/features/templates/data/queries'
import { splitArchived } from '#/shared/domain/archive'
import { freeUsage } from '../domain/plans'

/** Wykorzystanie limitów Free (strona planu); null, dopóki dane się ładują. */
export function useFreeUsage() {
  const projects = useQuery(projectsQuery).data
  const templates = useQuery(templatesQuery).data
  const statuses = useQuery(statusesQuery).data
  const types = useQuery(taskTypesQuery).data
  const isLoading = !projects || !templates || !statuses || !types
  if (isLoading) return null
  return freeUsage({
    projects: splitArchived(projects).active.length,
    quickTemplates: templates.length,
    statuses: splitArchived(statuses).active.length,
    customWorkTypes: types.filter((type) => !type.isSystem && !type.archivedAt)
      .length,
  })
}
