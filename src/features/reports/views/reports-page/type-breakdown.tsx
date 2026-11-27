import { ColorDot } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import type { ReportsViewModel } from '../../controllers/use-reports'

export interface TypeBreakdownProps {
  vm: ReportsViewModel
}

/** Podział czasu na rodzaje pracy: pasek udziałów i lista; klik w rodzaj filtruje raport. */
export function TypeBreakdown({ vm }: TypeBreakdownProps) {
  const t = useMessages(reportsMessages)
  const format = useFormat()
  return (
    <Panel title={t.byType.title} level={3}>
      <div
        role="img"
        aria-label={fmt(t.byType.chart, {
          list: vm.typeRows
            .map(
              (r) =>
                `${vm.typeOf(r.taskTypeId)?.name ?? ''} ${vm.percent(r.minutes)}%`,
            )
            .join(', '),
        })}
        className="flex h-3 gap-[3px] overflow-hidden rounded-full"
      >
        {vm.typeRows.map((r) => (
          <div
            key={r.taskTypeId}
            style={{
              flexGrow: r.minutes,
              background: vm.typeOf(r.taskTypeId)?.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {vm.typeRows.map((r) => {
          const type = vm.typeOf(r.taskTypeId)
          return (
            <li key={r.taskTypeId} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  aria-pressed={vm.typeId === r.taskTypeId}
                  onClick={() => vm.toggleType(r.taskTypeId)}
                  className="inline-flex min-h-6 items-center gap-2 rounded text-left font-medium underline-offset-4 hover:underline aria-pressed:underline"
                >
                  <ColorDot color={type?.color ?? 'var(--line)'} />
                  {type?.name}
                </button>
                <span className="font-semibold tabular-nums">
                  {format.minutes(r.minutes)}
                </span>
              </div>
              <p className="mt-0.5 pl-5 text-sm text-ink-soft">
                {fmt(t.byType.share, { pct: vm.percent(r.minutes) })} ·{' '}
                {r.withoutSp === r.tasks
                  ? t.table.noSp
                  : format.sp(r.storyPoints)}{' '}
                · {format.plural(t.byType.tasks, r.tasks)}
                {r.withoutSp > 0 && r.withoutSp < r.tasks && (
                  <> ({format.plural(t.byType.withoutSp, r.withoutSp)})</>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
