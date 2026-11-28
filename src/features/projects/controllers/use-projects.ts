import { useQuery } from '@tanstack/react-query'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { useFreePlan } from '#/features/billing/controllers/use-free-plan'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useArchive } from '#/shared/controllers/use-archive'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { splitArchived } from '#/shared/domain/archive'
import { projectsApi } from '../data/api'
import type { Project, ProjectInput } from '../data/dto'
import { projectsQuery } from '../data/queries'

/** Archiwizacja projektu i czy plan Free pozwala dodać kolejny aktywny projekt. */
export function useProjects() {
  const messages = useMessages(settingsMessages).projects
  const isFree = useFreePlan()
  const active = splitArchived(useQuery(projectsQuery).data ?? []).active
  const archive = useArchive(projectsApi.setArchived, {
    invalidate: keys.projects,
    messages,
  })
  return { archive, atLimit: isFree && active.length >= FREE_LIMITS.projects }
}

export interface SaveProjectOptions {
  /** Edytowany projekt albo null dla nowego. */
  project: Project | null
  onSaved: () => void
}

/** Zapis projektu: nowy albo zmiana istniejącego. */
export function useSaveProject({ project, onSaved }: SaveProjectOptions) {
  const messages = useMessages(settingsMessages).projects
  const app = useMessages(appMessages)
  return useDataMutation(
    (input: ProjectInput) =>
      project
        ? projectsApi.update(project.id, input)
        : projectsApi.create(input),
    {
      invalidate: [keys.projects],
      success: project ? app.status.saved : messages.created,
      onSuccess: onSaved,
    },
  )
}
