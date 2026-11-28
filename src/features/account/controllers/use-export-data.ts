import { useMessages } from '#/i18n/context'
import { panelMessages } from '#/i18n/messages/panel'
import { downloadFile } from '#/lib/download'
import { useDataMutation } from '#/shared/data/mutations'
import { accountApi } from '../data/api'

/** Nazwa pliku eksportu z dzisiejszą datą (timeblame-export-2026-11-27.json). */
export const exportFileName = (now = new Date()) =>
  `timeblame-export-${now.toISOString().slice(0, 10)}.json`

/** Pobranie wszystkich danych konta jako plik JSON (RODO: prawo do przenoszenia danych). */
export function useExportData() {
  const messages = useMessages(panelMessages).export
  const download = useDataMutation(() => accountApi.exportData(), {
    invalidate: [],
    success: messages.done,
    onSuccess: (payload) =>
      downloadFile(
        exportFileName(),
        [JSON.stringify(payload, null, 2)],
        'application/json',
      ),
  })
  return {
    busy: download.isPending,
    start: () => download.mutate(undefined),
  }
}
