import { Download } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { accountApi } from '#/features/account/data/api'
import { useMessages } from '#/i18n/context'
import { panelMessages } from '#/i18n/messages/panel'
import { downloadFile } from '#/lib/download'
import { useDataMutation } from '#/shared/data/mutations'
import { SettingsCard } from '#/features/settings/views/ui'

/** Pobranie wszystkich danych konta jako plik JSON (RODO: prawo do przenoszenia danych). */
export function ExportDataCard() {
  const t = useMessages(panelMessages).export
  const download = useDataMutation(() => accountApi.exportData(), {
    invalidate: [],
    success: t.done,
    onSuccess: (payload) => {
      downloadFile(
        `timeblame-export-${new Date().toISOString().slice(0, 10)}.json`,
        [JSON.stringify(payload, null, 2)],
        'application/json',
      )
    },
  })
  return (
    <SettingsCard title={t.title} lead={t.lead}>
      <Button
        variant="outline"
        disabled={download.isPending}
        aria-busy={download.isPending}
        onClick={() => download.mutate(undefined)}
      >
        <Download aria-hidden className="size-4" />
        {download.isPending ? t.busy : t.button}
      </Button>
    </SettingsCard>
  )
}
