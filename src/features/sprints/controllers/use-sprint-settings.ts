import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { markSetupStep } from '#/features/settings/controllers/setup-progress'
import { keys } from '#/shared/data/query-keys'
import { sprintsApi } from '../data/api'
import type { Sprint, SprintInput } from '../data/dto'

/** Zapis kadencji sprintów (albo jej wyłączenie, gdy null). */
export function useSaveCadence() {
  const messages = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  return useApplyMutation('sprints', sprintsApi.setCadence, {
    invalidate: [keys.cadence, keys.sprints],
    success: (result) => (result ? messages.scheduleSaved : app.status.saved),
    onSuccess: () => markSetupStep('sprints'),
  })
}

/** Usunięcie sprintu z listy. */
export function useRemoveSprint(onRemoved: () => void) {
  const messages = useMessages(settingsMessages).sprints
  return useApplyMutation(
    'sprints',
    (id: string, apply) => sprintsApi.remove(id, apply),
    {
      invalidate: [keys.sprints],
      success: messages.deleted,
      onSuccess: onRemoved,
    },
  )
}

export interface SaveSprintOptions {
  /** Edytowany sprint albo null dla nowego. */
  sprint: Sprint | null
  onSaved: () => void
}

/** Zapis sprintu: nowy albo zmiana istniejącego. */
export function useSaveSprint({ sprint, onSaved }: SaveSprintOptions) {
  const messages = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  return useApplyMutation(
    'sprints',
    (input: SprintInput, apply) =>
      sprint
        ? sprintsApi.update(sprint.id, input, apply)
        : sprintsApi.create(input, apply),
    {
      invalidate: [keys.sprints],
      success: sprint ? app.status.saved : messages.created,
      onSuccess: onSaved,
    },
  )
}
