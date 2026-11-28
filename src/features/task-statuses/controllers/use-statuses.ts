import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { useFreePlan } from '#/features/billing/controllers/use-free-plan'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useApplyArchive } from '#/features/workspaces/controllers/use-apply-archive'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { statusesApi } from '../data/api'
import type { TaskStatus, TaskStatusInput } from '../data/dto'

interface NamedItem {
  id: string
  name: string
}

/** Kolejność, domyślny status, archiwizacja i limit planu Free dla listy statusów. */
export function useStatuses(activeCount: number) {
  const t = useMessages(settingsMessages).statuses
  const reorder = useDataMutation(
    (ids: Array<string>) => statusesApi.reorder(ids),
    { invalidate: [keys.statuses] },
  )
  const makeDefault = useApplyMutation(
    'statuses',
    ({ id }: NamedItem, apply) => statusesApi.setDefault(id, apply),
    {
      invalidate: [keys.statuses],
      success: (_r, v) => fmt(t.defaultSet, { name: v.name }),
    },
  )
  const archive = useApplyArchive('statuses', statusesApi.setArchived, {
    invalidate: keys.statuses,
    messages: t,
  })
  const atLimit = useFreePlan() && activeCount >= FREE_LIMITS.statuses
  return { reorder, makeDefault, archive, atLimit }
}

export interface SaveStatusOptions {
  /** Edytowany status albo null dla nowego. */
  status: TaskStatus | null
  onSaved: () => void
}

/** Zapis statusu: nowy albo zmiana istniejącego. */
export function useSaveStatus({ status, onSaved }: SaveStatusOptions) {
  const t = useMessages(settingsMessages).statuses
  const app = useMessages(appMessages)
  return useApplyMutation(
    'statuses',
    (input: TaskStatusInput, apply) =>
      status
        ? statusesApi.update(status.id, input, apply)
        : statusesApi.create(input, apply),
    {
      invalidate: [keys.statuses],
      success: status ? app.status.saved : t.created,
      onSuccess: onSaved,
    },
  )
}
