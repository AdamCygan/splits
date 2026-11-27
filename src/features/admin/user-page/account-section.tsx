import { Button } from '#/components/ui/button'
import { Badge, Field, Select, Switch } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import type { PlanCode } from '#/data/types'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { PLANS } from '../model'
import type { UserPageViewModel } from './use-user-page'

export interface SectionProps {
  vm: UserPageViewModel
}

/** Dane konta i liczniki, plan, rola administratora i blokada. */
export function AccountSection({ vm }: SectionProps) {
  const t = useMessages(adminMessages)
  const a = t.user.account
  const format = useFormat()
  const { locale } = useI18n()
  const u = vm.user
  if (!u) return null
  const day = (value: string | null) =>
    value ? formatDate(locale, new Date(value)) : t.never
  return (
    <Panel title={a.title}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.9375rem] sm:grid-cols-3">
        {(
          [
            [a.joined, day(u.createdAt)],
            [a.lastLogin, day(u.lastLoginAt)],
            [a.lastActive, day(u.lastActiveAt)],
            [a.entries, format.number(u.entries, 0)],
            [
              a.lastEntry,
              u.lastEntryOn ? formatDate(locale, u.lastEntryOn) : t.never,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {vm.locked && (
        <p className="mt-5 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
          {u.isOwner && !vm.self ? a.owner : a.self}
        </p>
      )}
      {u.isDemo && (
        <p className="mt-5 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm">
          {a.demo}
        </p>
      )}

      {!u.isDemo && (
        <div className="mt-5 border-t border-line pt-5">
          <Field label={a.plan} hint={a.planHint}>
            {(control) => (
              <div className="flex max-w-md gap-2">
                <div className="flex-1">
                  <Select
                    {...control}
                    value={vm.plan}
                    onChange={(e) => vm.setPlan(e.target.value as PlanCode)}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {t.plans[p]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  className="h-11"
                  disabled={vm.busy || !vm.planChanged}
                  onClick={vm.savePlan}
                >
                  {a.savePlan}
                </Button>
              </div>
            )}
          </Field>
        </div>
      )}

      {!u.isDemo && !vm.locked && (
        <div className="mt-5 border-t border-line pt-5">
          <Switch
            label={a.role}
            description={a.roleHint}
            checked={u.role === 'admin'}
            disabled={vm.busy}
            onCheckedChange={vm.setRole}
          />
        </div>
      )}

      {!vm.locked && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="max-w-[46ch] text-sm text-ink-soft">
            {u.disabledAt ? (
              <Badge tone="warning">
                {fmt(a.blockedSince, { date: day(u.disabledAt) })}
              </Badge>
            ) : (
              a.blockHint
            )}
          </p>
          {u.disabledAt ? (
            <Button variant="outline" disabled={vm.busy} onClick={vm.unblock}>
              {a.unblock}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={vm.busy}
              onClick={() => vm.openDialog('block')}
            >
              {a.block}
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
