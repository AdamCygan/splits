import { Download, Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { AdminUserFilter } from '#/features/admin/data/dto'
import { INACTIVE_DAY_OPTIONS } from '#/features/admin/domain/admin'
import { useFormat, useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { PLANS } from '../../domain/filters'
import type { UsersPageViewModel } from '../../controllers/use-users-page'

export interface UserFiltersProps {
  viewModel: UsersPageViewModel
}

/** Wyszukiwanie i filtry listy kont (wszystkie w adresie strony) oraz eksport CSV. */
export function UserFilters({ viewModel }: UserFiltersProps) {
  const messages = useMessages(adminMessages).filters
  const plans = useMessages(adminMessages).plans
  const format = useFormat()
  const { filter } = viewModel
  const select = <TKey extends keyof AdminUserFilter>(
    key: TKey,
    value: string,
  ) =>
    viewModel.setFilter({
      [key]: value === '' ? undefined : value,
    })
  return (
    <section aria-label={messages.label} className="mb-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Field label={messages.search}>
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                {...control}
                type="search"
                value={viewModel.search}
                placeholder={messages.searchPlaceholder}
                onChange={(event) => viewModel.setSearch(event.target.value)}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <Field label={messages.plan}>
          {(control) => (
            <Select
              {...control}
              value={filter.plan ?? ''}
              onChange={(event) => select('plan', event.target.value)}
            >
              <option value="">{messages.allPlans}</option>
              {PLANS.map((plan) => (
                <option key={plan} value={plan}>
                  {plans[plan]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={messages.status}>
          {(control) => (
            <Select
              {...control}
              value={filter.status ?? ''}
              onChange={(event) => select('status', event.target.value)}
            >
              <option value="">{messages.allStatuses}</option>
              <option value="active">{messages.active}</option>
              <option value="blocked">{messages.blocked}</option>
              <option value="demo">{messages.demo}</option>
            </Select>
          )}
        </Field>
        <Field label={messages.payment}>
          {(control) => (
            <Select
              {...control}
              value={filter.payment ?? ''}
              onChange={(event) => select('payment', event.target.value)}
            >
              <option value="">{messages.anyPayment}</option>
              <option value="problem">{messages.paymentProblem}</option>
            </Select>
          )}
        </Field>
        <Field label={messages.email}>
          {(control) => (
            <Select
              {...control}
              value={filter.email ?? ''}
              onChange={(event) => select('email', event.target.value)}
            >
              <option value="">{messages.anyEmail}</option>
              <option value="unverified">{messages.unverified}</option>
            </Select>
          )}
        </Field>
        <Field label={messages.twoFactor}>
          {(control) => (
            <Select
              {...control}
              value={filter.twoFactor ?? ''}
              onChange={(event) => select('twoFactor', event.target.value)}
            >
              <option value="">{messages.anyTwoFactor}</option>
              <option value="on">{messages.twoFactorOn}</option>
              <option value="off">{messages.twoFactorOff}</option>
            </Select>
          )}
        </Field>
        <Field label={messages.inactive}>
          {(control) => (
            <Select
              {...control}
              value={filter.inactiveDays ? String(filter.inactiveDays) : ''}
              onChange={(event) =>
                viewModel.setFilter({
                  inactiveDays: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            >
              <option value="">{messages.anyActivity}</option>
              {INACTIVE_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {format.plural(messages.inactiveDays, days)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-end gap-2">
          {viewModel.activeFilters > 0 && (
            <Button
              variant="ghost"
              className="h-11"
              onClick={viewModel.clearFilters}
            >
              {messages.clear}
            </Button>
          )}
          <Button
            variant="outline"
            className="ml-auto h-11"
            disabled={viewModel.exporting}
            aria-busy={viewModel.exporting}
            onClick={() => void viewModel.exportCsv()}
          >
            <Download aria-hidden className="size-4" />
            {viewModel.exporting ? messages.exporting : messages.export}
          </Button>
        </div>
      </div>
    </section>
  )
}
