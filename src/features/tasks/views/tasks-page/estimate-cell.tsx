import { Check, TriangleAlert, Zap } from 'lucide-react'
import type { TaskRow } from '#/features/reports/domain/report'
import type { estimateOf } from '#/features/sprints/domain/sprint-stats'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'

export interface EstimateCellProps {
  row: TaskRow
  estimate: ReturnType<typeof estimateOf>
}

/** Wycena słowami z ikoną; szczegóły (przedział SP albo własna estymata) w dymku. */
export function EstimateCell({ row, estimate }: EstimateCellProps) {
  const messages = useMessages(panelMessages).tasks
  const format = useFormat()
  if (!estimate)
    return (
      <p className="text-sm text-ink-faint">
        <span className="sr-only">{messages.columns.estimate}: </span>
        {messages.noEstimate}
      </p>
    )
  const detail =
    estimate.source === 'estimate'
      ? fmt(messages.ownEstimate, {
          time: format.minutes(estimate.max),
          actual: format.minutes(row.minutes),
        })
      : fmt(messages.range, {
          sp: format.sp(row.storyPoints ?? 0),
          min: format.minutes(estimate.min),
          max: format.minutes(estimate.max),
        })
  const Icon =
    estimate.status === 'over'
      ? TriangleAlert
      : estimate.status === 'under'
        ? Zap
        : Check
  return (
    <p
      title={detail}
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        estimate.status === 'over'
          ? 'text-warn'
          : estimate.status === 'under'
            ? 'text-ok'
            : 'text-ink-soft',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>
        <span className="sr-only">{messages.columns.estimate}: </span>
        {estimate.status === 'over'
          ? fmt(messages.overShort, { time: format.minutes(estimate.overBy) })
          : messages.badge[estimate.status]}
        <span className="sr-only">. {detail}</span>
      </span>
    </p>
  )
}
