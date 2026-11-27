import { Download, Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { AdminUserFilter } from '#/features/admin/data/dto'
import { INACTIVE_DAY_OPTIONS } from '#/domain/admin'
import { useFormat, useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { PLANS } from '../model'
import type { UsersPageViewModel } from './use-users-page'

export interface UserFiltersProps {
  vm: UsersPageViewModel
}

/** Wyszukiwanie i filtry listy kont (wszystkie w adresie strony) oraz eksport CSV. */
export function UserFilters({ vm }: UserFiltersProps) {
  const t = useMessages(adminMessages).filters
  const plans = useMessages(adminMessages).plans
  const format = useFormat()
  const { filter } = vm
  const select = <TKey extends keyof AdminUserFilter>(
    key: TKey,
    value: string,
  ) =>
    vm.setFilter({
      [key]: value === '' ? undefined : value,
    })
  return (
    <section aria-label={t.label} className="mb-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Field label={t.search}>
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                {...control}
                type="search"
                value={vm.search}
                placeholder={t.searchPlaceholder}
                onChange={(e) => vm.setSearch(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <Field label={t.plan}>
          {(control) => (
            <Select
              {...control}
              value={filter.plan ?? ''}
              onChange={(e) => select('plan', e.target.value)}
            >
              <option value="">{t.allPlans}</option>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {plans[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.status}>
          {(control) => (
            <Select
              {...control}
              value={filter.status ?? ''}
              onChange={(e) => select('status', e.target.value)}
            >
              <option value="">{t.allStatuses}</option>
              <option value="active">{t.active}</option>
              <option value="blocked">{t.blocked}</option>
              <option value="demo">{t.demo}</option>
            </Select>
          )}
        </Field>
        <Field label={t.payment}>
          {(control) => (
            <Select
              {...control}
              value={filter.payment ?? ''}
              onChange={(e) => select('payment', e.target.value)}
            >
              <option value="">{t.anyPayment}</option>
              <option value="problem">{t.paymentProblem}</option>
            </Select>
          )}
        </Field>
        <Field label={t.email}>
          {(control) => (
            <Select
              {...control}
              value={filter.email ?? ''}
              onChange={(e) => select('email', e.target.value)}
            >
              <option value="">{t.anyEmail}</option>
              <option value="unverified">{t.unverified}</option>
            </Select>
          )}
        </Field>
        <Field label={t.twoFactor}>
          {(control) => (
            <Select
              {...control}
              value={filter.twoFactor ?? ''}
              onChange={(e) => select('twoFactor', e.target.value)}
            >
              <option value="">{t.anyTwoFactor}</option>
              <option value="on">{t.twoFactorOn}</option>
              <option value="off">{t.twoFactorOff}</option>
            </Select>
          )}
        </Field>
        <Field label={t.inactive}>
          {(control) => (
            <Select
              {...control}
              value={filter.inactiveDays ? String(filter.inactiveDays) : ''}
              onChange={(e) =>
                vm.setFilter({
                  inactiveDays: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            >
              <option value="">{t.anyActivity}</option>
              {INACTIVE_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {format.plural(t.inactiveDays, days)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-end gap-2">
          {vm.activeFilters > 0 && (
            <Button variant="ghost" className="h-11" onClick={vm.clearFilters}>
              {t.clear}
            </Button>
          )}
          <Button
            variant="outline"
            className="ml-auto h-11"
            disabled={vm.exporting}
            aria-busy={vm.exporting}
            onClick={() => void vm.exportCsv()}
          >
            <Download aria-hidden className="size-4" />
            {vm.exporting ? t.exporting : t.export}
          </Button>
        </div>
      </div>
    </section>
  )
}
