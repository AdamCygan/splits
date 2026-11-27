import { Check, TriangleAlert, Zap } from 'lucide-react'
import type { TaskRow } from '#/domain/report'
import type { estimateOf } from '#/domain/sprint-stats'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'

export interface EstimateCellProps {
  row: TaskRow
  estimate: ReturnType<typeof estimateOf>
}

/** Wycena słowami z ikoną; szczegóły (przedział SP albo własna estymata) w dymku. */
export function EstimateCell({ row, estimate: e }: EstimateCellProps) {
  const t = useMessages(panelMessages).tasks
  const format = useFormat()
  if (!e)
    return (
      <p className="text-sm text-ink-faint">
        <span className="sr-only">{t.columns.estimate}: </span>
        {t.noEstimate}
      </p>
    )
  const detail =
    e.source === 'estimate'
      ? fmt(t.ownEstimate, {
          time: format.minutes(e.max),
          actual: format.minutes(row.minutes),
        })
      : fmt(t.range, {
          sp: format.sp(row.storyPoints ?? 0),
          min: format.minutes(e.min),
          max: format.minutes(e.max),
        })
  const Icon =
    e.status === 'over' ? TriangleAlert : e.status === 'under' ? Zap : Check
  return (
    <p
      title={detail}
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        e.status === 'over'
          ? 'text-warn'
          : e.status === 'under'
            ? 'text-ok'
            : 'text-ink-soft',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>
        <span className="sr-only">{t.columns.estimate}: </span>
        {e.status === 'over'
          ? fmt(t.overShort, { time: format.minutes(e.overBy) })
          : t.badge[e.status]}
        <span className="sr-only">. {detail}</span>
      </span>
    </p>
  )
}
