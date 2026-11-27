import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { markSetupStep } from '#/features/settings/controllers/setup-progress'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { sprintsApi } from '../data/api'
import type { Sprint, SprintInput } from '../data/dto'

/** Zapis kadencji sprintów (albo jej wyłączenie, gdy null). */
export function useSaveCadence() {
  const t = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  return useDataMutation(sprintsApi.setCadence, {
    invalidate: [keys.cadence, keys.sprints],
    success: (result) => (result ? t.scheduleSaved : app.status.saved),
    onSuccess: () => markSetupStep('sprints'),
  })
}

/** Usunięcie sprintu z listy. */
export function useRemoveSprint(onRemoved: () => void) {
  const t = useMessages(settingsMessages).sprints
  return useDataMutation((id: string) => sprintsApi.remove(id), {
    invalidate: [keys.sprints],
    success: t.deleted,
    onSuccess: onRemoved,
  })
}

export interface SaveSprintOptions {
  /** Edytowany sprint albo null dla nowego. */
  sprint: Sprint | null
  onSaved: () => void
}

/** Zapis sprintu: nowy albo zmiana istniejącego. */
export function useSaveSprint({ sprint, onSaved }: SaveSprintOptions) {
  const t = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  return useDataMutation(
    (input: SprintInput) =>
      sprint ? sprintsApi.update(sprint.id, input) : sprintsApi.create(input),
    {
      invalidate: [keys.sprints],
      success: sprint ? app.status.saved : t.created,
      onSuccess: onSaved,
    },
  )
}
