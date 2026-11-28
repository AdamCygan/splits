import { useQuery } from '@tanstack/react-query'
import { useFreePlan } from '#/features/billing/controllers/use-free-plan'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { markSetupStep } from '#/features/settings/controllers/setup-progress'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { templatesApi } from '../data/api'
import type { QuickTemplate, QuickTemplateInput } from '../data/dto'
import { templatesQuery } from '../data/queries'

/** Kolejność i usuwanie szablonów oraz limit szablonów w planie Free. */
export function useTemplates(onRemoved: () => void) {
  const messages = useMessages(settingsMessages).templates
  const count = (useQuery(templatesQuery).data ?? []).length
  const isFree = useFreePlan()
  const reorder = useDataMutation(
    (ids: Array<string>) => templatesApi.reorder(ids),
    { invalidate: [keys.templates] },
  )
  const remove = useDataMutation((id: string) => templatesApi.remove(id), {
    invalidate: [keys.templates],
    success: messages.deleted,
    onSuccess: onRemoved,
  })
  return {
    reorder,
    remove,
    atLimit: isFree && count >= FREE_LIMITS.quickTemplates,
  }
}

export interface SaveTemplateOptions {
  /** Edytowany szablon albo null dla nowego. */
  template: QuickTemplate | null
  onSaved: () => void
}

/** Zapis szablonu (nowy albo zmiana); krok konfiguracji „szablony” zaliczony. */
export function useSaveTemplate({ template, onSaved }: SaveTemplateOptions) {
  const messages = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  return useDataMutation(
    (input: QuickTemplateInput) =>
      template
        ? templatesApi.update(template.id, input)
        : templatesApi.create(input),
    {
      invalidate: [keys.templates],
      success: template ? app.status.saved : messages.created,
      onSuccess: () => {
        markSetupStep('templates')
        onSaved()
      },
    },
  )
}
