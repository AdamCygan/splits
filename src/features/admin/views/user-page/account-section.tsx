import { Button } from '#/components/ui/button'
import { Badge, Field, Select, Switch } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import type { PlanCode } from '#/features/auth/data/dto'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { PLANS } from '../../domain/filters'
import type { UserPageViewModel } from '../../controllers/use-user-page'

export interface SectionProps {
  viewModel: UserPageViewModel
}

/** Dane konta i liczniki, plan, rola administratora i blokada. */
export function AccountSection({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages)
  const account = messages.user.account
  const format = useFormat()
  const { locale } = useI18n()
  const user = viewModel.user
  if (!user) return null
  const day = (value: string | null) =>
    value ? formatDate(locale, new Date(value)) : messages.never
  return (
    <Panel title={account.title}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.9375rem] sm:grid-cols-3">
        {(
          [
            [account.joined, day(user.createdAt)],
            [account.lastLogin, day(user.lastLoginAt)],
            [account.lastActive, day(user.lastActiveAt)],
            [account.entries, format.number(user.entries, 0)],
            [
              account.lastEntry,
              user.lastEntryOn
                ? formatDate(locale, user.lastEntryOn)
                : messages.never,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {viewModel.locked && (
        <p className="mt-5 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
          {user.isOwner && !viewModel.self ? account.owner : account.self}
        </p>
      )}
      {user.isDemo && (
        <p className="mt-5 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
          {account.demo}
        </p>
      )}

      {!user.isDemo && (
        <div className="mt-5 border-t border-line pt-5">
          <Field label={account.plan} hint={account.planHint}>
            {(control) => (
              <div className="flex max-w-md gap-2">
                <div className="flex-1">
                  <Select
                    {...control}
                    value={viewModel.plan}
                    onChange={(event) =>
                      viewModel.setPlan(event.target.value as PlanCode)
                    }
                  >
                    {PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {messages.plans[plan]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  className="h-11"
                  disabled={viewModel.busy || !viewModel.planChanged}
                  onClick={viewModel.savePlan}
                >
                  {account.savePlan}
                </Button>
              </div>
            )}
          </Field>
        </div>
      )}

      {!user.isDemo && !viewModel.locked && (
        <div className="mt-5 border-t border-line pt-5">
          <Switch
            label={account.role}
            description={account.roleHint}
            checked={user.role === 'admin'}
            disabled={viewModel.busy}
            onCheckedChange={viewModel.setRole}
          />
        </div>
      )}

      {!viewModel.locked && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="max-w-[46ch] text-sm text-ink-soft">
            {user.disabledAt ? (
              <Badge tone="warning">
                {fmt(account.blockedSince, { date: day(user.disabledAt) })}
              </Badge>
            ) : (
              account.blockHint
            )}
          </p>
          {user.disabledAt ? (
            <Button
              variant="outline"
              disabled={viewModel.busy}
              onClick={viewModel.unblock}
            >
              {account.unblock}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={viewModel.busy}
              onClick={() => viewModel.openDialog('block')}
            >
              {account.block}
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
