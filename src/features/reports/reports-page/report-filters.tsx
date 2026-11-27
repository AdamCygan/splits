import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Button, buttonVariants } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { REPORT_PRESETS } from '#/domain/report'
import type { ReportPeriod } from '#/domain/report'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import type { ReportsViewModel } from './use-reports'

export interface ReportFiltersProps {
  vm: ReportsViewModel
}

/** Okres (sprinty i kalendarz, własne daty), rodzaj pracy i eksport CSV. */
export function ReportFilters({ vm }: ReportFiltersProps) {
  const t = useMessages(reportsMessages)
  return (
    <section
      aria-label={t.filters}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <Field label={t.period} className="w-full sm:w-72">
        {(a) => (
          <Select
            {...a}
            value={vm.period}
            onChange={(e) => vm.choosePeriod(e.target.value as ReportPeriod)}
          >
            {vm.recent.length > 0 && (
              <optgroup label={t.sprintsGroup}>
                {vm.recent.map((s) => (
                  <option key={s.id} value={`sprint:${s.id}`}>
                    {s.id === vm.current?.id
                      ? fmt(t.currentSprint, { name: s.name })
                      : s.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t.calendarGroup}>
              {REPORT_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {t.presets[p]}
                </option>
              ))}
              <option value="custom">{t.presets.custom}</option>
            </optgroup>
          </Select>
        )}
      </Field>

      {vm.period === 'custom' && (
        <>
          <Field
            label={t.from}
            className="w-[calc(50%-0.5rem)] sm:w-44"
            error={vm.customValid ? null : t.rangeError}
          >
            {(a) => (
              <Input
                {...a}
                type="date"
                value={vm.custom.from}
                max={vm.custom.to}
                onChange={(e) =>
                  vm.setCustom({ ...vm.custom, from: e.target.value })
                }
              />
            )}
          </Field>
          <Field label={t.to} className="w-[calc(50%-0.5rem)] sm:w-44">
            {(a) => (
              <Input
                {...a}
                type="date"
                value={vm.custom.to}
                min={vm.custom.from}
                onChange={(e) =>
                  vm.setCustom({ ...vm.custom, to: e.target.value })
                }
              />
            )}
          </Field>
        </>
      )}

      <Field label={t.type} className="w-full sm:w-60">
        {(a) => (
          <Select
            {...a}
            value={vm.typeId}
            onChange={(e) => vm.setTypeId(e.target.value)}
          >
            <option value="">{t.allTypes}</option>
            {vm.activeTypes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="sm:ml-auto">
        {vm.isFree ? (
          <Link
            to="/app/settings/plan"
            className={buttonVariants({ variant: 'outline' })}
          >
            <Download aria-hidden className="size-4" />
            {t.exportPro}
          </Link>
        ) : (
          <Button
            variant="outline"
            onClick={vm.exportCsv}
            disabled={vm.sorted.length === 0}
          >
            <Download aria-hidden className="size-4" />
            {t.exportCsv}
          </Button>
        )}
      </div>
    </section>
  )
}
