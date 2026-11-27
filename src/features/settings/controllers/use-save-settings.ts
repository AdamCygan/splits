import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { settingsApi } from '../data/api'
import type { UserSettings } from '../data/dto'
import { markSetupStep } from './setup-progress'

/** Zapis dnia pracy (cel, dni, zaokrąglanie, przypomnienia); sprinty liczą się od nowa. */
export function useSaveWorkday() {
  const app = useMessages(appMessages)
  return useDataMutation(settingsApi.update, {
    invalidate: [keys.settings, keys.sprints],
    success: app.status.saved,
    onSuccess: () => markSetupStep('workday'),
  })
}

/** Zapis szablonu podsumowania zadania (null = domyślny szablon dla języka). */
export function useSaveSummaryTemplate(settings: UserSettings) {
  const t = useMessages(settingsMessages).summaries
  return useDataMutation(
    (template: string | null) =>
      settingsApi.update({ ...settings, summaryTemplate: template }),
    { invalidate: [keys.settings], success: t.saved },
  )
}
