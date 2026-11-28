import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Button, buttonVariants } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { REPORT_PRESETS } from '#/features/reports/domain/report'
import type { ReportPeriod } from '#/features/reports/domain/report'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import type { ReportsViewModel } from '../../controllers/use-reports'

export interface ReportFiltersProps {
  viewModel: ReportsViewModel
}

/** Okres (sprinty i kalendarz, własne daty), rodzaj pracy i eksport CSV. */
export function ReportFilters({ viewModel }: ReportFiltersProps) {
  const messages = useMessages(reportsMessages)
  return (
    <section
      aria-label={messages.filters}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <Field label={messages.period} className="w-full sm:w-72">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={viewModel.period}
            onChange={(event) =>
              viewModel.choosePeriod(event.target.value as ReportPeriod)
            }
          >
            {viewModel.recent.length > 0 && (
              <optgroup label={messages.sprintsGroup}>
                {viewModel.recent.map((sprint) => (
                  <option key={sprint.id} value={`sprint:${sprint.id}`}>
                    {sprint.id === viewModel.current?.id
                      ? fmt(messages.currentSprint, { name: sprint.name })
                      : sprint.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={messages.calendarGroup}>
              {REPORT_PRESETS.map((reportPreset) => (
                <option key={reportPreset} value={reportPreset}>
                  {messages.presets[reportPreset]}
                </option>
              ))}
              <option value="custom">{messages.presets.custom}</option>
            </optgroup>
          </Select>
        )}
      </Field>

      {viewModel.period === 'custom' && (
        <>
          <Field
            label={messages.from}
            className="w-[calc(50%-0.5rem)] sm:w-44"
            error={viewModel.customValid ? null : messages.rangeError}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                value={viewModel.custom.from}
                max={viewModel.custom.to}
                onChange={(event) =>
                  viewModel.setCustom({
                    ...viewModel.custom,
                    from: event.target.value,
                  })
                }
              />
            )}
          </Field>
          <Field label={messages.to} className="w-[calc(50%-0.5rem)] sm:w-44">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                value={viewModel.custom.to}
                min={viewModel.custom.from}
                onChange={(event) =>
                  viewModel.setCustom({
                    ...viewModel.custom,
                    to: event.target.value,
                  })
                }
              />
            )}
          </Field>
        </>
      )}

      <Field label={messages.type} className="w-full sm:w-60">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={viewModel.typeId}
            onChange={(event) => viewModel.setTypeId(event.target.value)}
          >
            <option value="">{messages.allTypes}</option>
            {viewModel.activeTypes.map((archivable) => (
              <option key={archivable.id} value={archivable.id}>
                {archivable.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="sm:ml-auto">
        {viewModel.isFree ? (
          <Link
            to="/app/settings/plan"
            className={buttonVariants({ variant: 'outline' })}
          >
            <Download aria-hidden className="size-4" />
            {messages.exportPro}
          </Link>
        ) : (
          <Button
            variant="outline"
            onClick={viewModel.exportCsv}
            disabled={viewModel.sorted.length === 0}
          >
            <Download aria-hidden className="size-4" />
            {messages.exportCsv}
          </Button>
        )}
      </div>
    </section>
  )
}
