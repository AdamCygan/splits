import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { markSetupStep } from '#/features/settings/controllers/setup-progress'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys } from '#/shared/data/query-keys'
import { spScaleApi } from '../data/api'

/** Zapis całej skali story pointów (limity czasu dla każdej wartości). */
export function useSaveScale() {
  const t = useMessages(settingsMessages).storyPoints
  return useApplyMutation('storyPoints', spScaleApi.replace, {
    invalidate: [keys.scale],
    success: t.saved,
    onSuccess: () => markSetupStep('storyPoints'),
  })
}
