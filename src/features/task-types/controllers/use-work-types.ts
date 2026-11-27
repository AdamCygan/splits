import { useCurrentUser } from '#/features/auth/data/session'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { markSetupStep } from '#/features/settings/controllers/setup-progress'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useArchive } from '#/shared/controllers/use-archive'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { taskTypesApi } from '../data/api'
import type { TaskType, TaskTypeInput } from '../data/dto'

/** Archiwizacja rodzajów pracy i limit własnych rodzajów w planie Free. */
export function useWorkTypes() {
  const t = useMessages(settingsMessages).workTypes
  const limited = !hasProAccess(useCurrentUser())
  const archive = useArchive(taskTypesApi.setArchived, {
    invalidate: keys.taskTypes,
    messages: t,
  })
  return {
    archive,
    /** Czy plan Free nie pozwala dodać kolejnego własnego rodzaju pracy. */
    atLimit: (customCount: number) =>
      limited && customCount >= FREE_LIMITS.customWorkTypes,
  }
}

export interface SaveWorkTypeOptions {
  /** Edytowany rodzaj pracy albo null dla nowego. */
  type: TaskType | null
  onSaved: () => void
}

/** Zapis rodzaju pracy (nowy albo zmiana); krok konfiguracji „rodzaje pracy” zaliczony. */
export function useSaveWorkType({ type, onSaved }: SaveWorkTypeOptions) {
  const t = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  return useDataMutation(
    (input: TaskTypeInput) =>
      type ? taskTypesApi.update(type.id, input) : taskTypesApi.create(input),
    {
      invalidate: [keys.taskTypes],
      success: type ? app.status.saved : t.created,
      onSuccess: () => {
        markSetupStep('workTypes')
        onSaved()
      },
    },
  )
}
