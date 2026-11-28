import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useQuery } from '@tanstack/react-query'
import { settingsQuery } from '../data/queries'
import { workdayChanged } from '../domain/workday'
import { keys } from '#/shared/data/query-keys'
import { settingsApi } from '../data/api'
import type { UserSettings } from '../data/dto'
import { markSetupStep } from './setup-progress'

/** Zapis dnia pracy (cel, dni, zaokrąglanie, przypomnienia); sprinty liczą się od nowa. */
export function useSaveWorkday() {
  const app = useMessages(appMessages)
  const { data: current } = useQuery(settingsQuery)
  return useApplyMutation('workday', settingsApi.update, {
    invalidate: [keys.settings, keys.sprints],
    success: app.status.saved,
    onSuccess: () => markSetupStep('workday'),
    // Sama strefa, początek tygodnia czy przypomnienie należą do konta: wtedy nie pytamy.
    asks: (next) => !current || workdayChanged(current, next),
  })
}

/** Zapis szablonu podsumowania zadania (null = domyślny szablon dla języka). */
export function useSaveSummaryTemplate(settings: UserSettings) {
  const t = useMessages(settingsMessages).summaries
  return useApplyMutation(
    'workday',
    (template: string | null, apply) =>
      settingsApi.update({ ...settings, summaryTemplate: template }, apply),
    { invalidate: [keys.settings], success: t.saved },
  )
}
