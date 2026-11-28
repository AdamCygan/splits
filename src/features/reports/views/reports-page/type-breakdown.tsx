import { ColorDot } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import type { ReportsViewModel } from '../../controllers/use-reports'

export interface TypeBreakdownProps {
  viewModel: ReportsViewModel
}

/** Podział czasu na rodzaje pracy: pasek udziałów i lista; klik w rodzaj filtruje raport. */
export function TypeBreakdown({ viewModel }: TypeBreakdownProps) {
  const messages = useMessages(reportsMessages)
  const format = useFormat()
  return (
    <Panel title={messages.byType.title} level={3}>
      <div
        role="img"
        aria-label={fmt(messages.byType.chart, {
          list: viewModel.typeRows
            .map(
              (typeRow) =>
                `${viewModel.typeOf(typeRow.taskTypeId)?.name ?? ''} ${viewModel.percent(typeRow.minutes)}%`,
            )
            .join(', '),
        })}
        className="flex h-3 gap-[3px] overflow-hidden rounded-full"
      >
        {viewModel.typeRows.map((typeRow) => (
          <div
            key={typeRow.taskTypeId}
            style={{
              flexGrow: typeRow.minutes,
              background: viewModel.typeOf(typeRow.taskTypeId)?.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {viewModel.typeRows.map((typeRow) => {
          const type = viewModel.typeOf(typeRow.taskTypeId)
          return (
            <li key={typeRow.taskTypeId} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  aria-pressed={viewModel.typeId === typeRow.taskTypeId}
                  onClick={() => viewModel.toggleType(typeRow.taskTypeId)}
                  className="inline-flex min-h-6 items-center gap-2 rounded text-left font-medium underline-offset-4 hover:underline aria-pressed:underline"
                >
                  <ColorDot color={type?.color ?? 'var(--line)'} />
                  {type?.name}
                </button>
                <span className="font-semibold tabular-nums">
                  {format.minutes(typeRow.minutes)}
                </span>
              </div>
              <p className="mt-0.5 pl-5 text-sm text-ink-soft">
                {fmt(messages.byType.share, {
                  pct: viewModel.percent(typeRow.minutes),
                })}{' '}
                ·{' '}
                {typeRow.withoutSp === typeRow.tasks
                  ? messages.table.noSp
                  : format.sp(typeRow.storyPoints)}{' '}
                · {format.plural(messages.byType.tasks, typeRow.tasks)}
                {typeRow.withoutSp > 0 && typeRow.withoutSp < typeRow.tasks && (
                  <>
                    {' '}
                    (
                    {format.plural(
                      messages.byType.withoutSp,
                      typeRow.withoutSp,
                    )}
                    )
                  </>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
