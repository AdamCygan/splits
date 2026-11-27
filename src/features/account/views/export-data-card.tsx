import { Download } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { SettingsCard } from '#/features/settings/views/ui'
import { useMessages } from '#/i18n/context'
import { panelMessages } from '#/i18n/messages/panel'
import { useExportData } from '../controllers/use-export-data'

/** Pobranie wszystkich danych konta jako plik JSON (RODO: prawo do przenoszenia danych). */
export function ExportDataCard() {
  const t = useMessages(panelMessages).export
  const exportData = useExportData()
  return (
    <SettingsCard title={t.title} lead={t.lead}>
      <Button
        variant="outline"
        disabled={exportData.busy}
        aria-busy={exportData.busy}
        onClick={exportData.start}
      >
        <Download aria-hidden className="size-4" />
        {exportData.busy ? t.busy : t.button}
      </Button>
    </SettingsCard>
  )
}
