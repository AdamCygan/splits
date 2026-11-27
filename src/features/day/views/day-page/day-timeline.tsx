import { useId, useState } from 'react'
import type { MouseEvent } from 'react'
import { Panel } from '#/components/ui/panel'
import { stackOrder } from '#/features/reports/domain/analytics'
import { blockIndexAt, timelineAxis } from '#/features/day/domain/day-summary'
import type { DayBlock } from '#/features/day/domain/day-summary'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import { cn } from '#/lib/utils'
import type { DayViewModel } from '../../controllers/use-day'

const BREAK_FILL =
  'repeating-linear-gradient(135deg, var(--ink-faint) 0 2px, transparent 2px 6px)'

export interface DayTimelineProps {
  vm: DayViewModel
}

/**
 * Oś dnia: sesje w kolorze rodzaju pracy, przerwy w paski. Mysz albo strzałki wybierają
 * odcinek (dymek ze szczegółami), kliknięcie albo Enter otwiera zadanie.
 */
export function DayTimeline({ vm }: DayTimelineProps) {
  const t = useMessages(dayViewMessages).timeline
  const format = useFormat()
  const [active, setActive] = useState<number | null>(null)
  const liveId = useId()
  const { blocks, span, untimedMinutes } = vm.summary
  const untimed = untimedMinutes > 0 && (
    <p className={cn('text-sm text-ink-soft', span ? 'mt-3' : 'mt-1')}>
      {fmt(t.untimed, { time: format.minutes(untimedMinutes) })}
    </p>
  )

  if (!span)
    return (
      <Panel title={t.title} lead={t.lead}>
        <p className="text-sm text-ink-soft">{t.noTimes}</p>
        {untimed}
      </Panel>
    )

  const axis = timelineAxis(span)
  const used = stackOrder(
    vm.types.filter((x) => blocks.some((b) => b.taskTypeId === x.id)),
  )
  const labelOf = (b: DayBlock) =>
    fmt(t.block, {
      name:
        b.kind === 'break'
          ? t.break
          : `${vm.typeOf(b.taskTypeId)?.name ?? ''}: ${b.title}`,
      from: format.time(b.start),
      to: format.time(b.end),
      time: format.minutes(b.minutes),
    })
  const minuteAt = (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return axis.at((e.clientX - box.left) / box.width)
  }
  const current = active !== null ? blocks[active] : undefined

  return (
    <Panel title={t.title} lead={t.lead} className="mt-6">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {used.map((k) => (
          <li key={k.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: k.color }}
            />
            {k.name}
          </li>
        ))}
        {blocks.some((b) => b.kind === 'break') && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full border border-ink-faint"
              style={{ background: BREAK_FILL }}
            />
            {t.break}
          </li>
        )}
      </ul>
      <div className="relative pt-1">
        <div
          role="group"
          tabIndex={0}
          aria-label={t.keys}
          aria-describedby={liveId}
          className="relative h-14 cursor-pointer rounded-md bg-muted outline-offset-4"
          onPointerMove={(e) => {
            const i = blockIndexAt(blocks, minuteAt(e))
            setActive(i === -1 ? null : i)
          }}
          onPointerLeave={() => setActive(null)}
          // Odcinek pod kursorem (także przy dotyku, gdzie nie ma najechania).
          onClick={(e) =>
            vm.openBlock(blocks[blockIndexAt(blocks, minuteAt(e))])
          }
          onFocus={() => setActive((v) => v ?? 0)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            const move =
              e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (move)
              setActive((v) =>
                Math.min(blocks.length - 1, Math.max(0, (v ?? -1) + move)),
              )
            else if (e.key === 'Home') setActive(0)
            else if (e.key === 'End') setActive(blocks.length - 1)
            else if (e.key === 'Enter' || e.key === ' ') vm.openBlock(current)
            else return
            e.preventDefault()
          }}
        >
          {blocks.map((b, i) => (
            <span
              key={b.id}
              aria-hidden
              className={cn(
                'pointer-events-none absolute border-x border-surface',
                b.kind === 'break' ? 'inset-y-3 rounded-sm' : 'inset-y-0',
                active === i && 'z-10 ring-2 ring-ink ring-offset-1',
              )}
              style={{
                left: `${axis.x(b.start)}%`,
                width: `max(3px, ${axis.x(b.end) - axis.x(b.start)}%)`,
                background:
                  b.kind === 'break' ? BREAK_FILL : vm.colorOf(b.taskTypeId),
              }}
            />
          ))}
        </div>
        <p id={liveId} aria-live="polite" className="sr-only">
          {current ? labelOf(current) : ''}
        </p>
        {current && (
          <div
            role="presentation"
            className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(Math.max(axis.x((current.start + current.end) / 2), 12), 88)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold">
              {current.kind === 'break' ? t.break : current.title}
            </p>
            <p className="mt-0.5 text-ink-soft tabular-nums">
              {format.timeRange(current.start, current.end)},{' '}
              {format.minutes(current.minutes)}
            </p>
            {current.kind === 'work' && (
              <p className="mt-0.5 text-ink-soft">{t.open}</p>
            )}
          </div>
        )}
        <div
          aria-hidden
          className="relative mt-1.5 h-4 text-xs text-ink-soft tabular-nums"
        >
          {axis.ticks.map((m, i) => {
            const edge = i === 0 || i === axis.ticks.length - 1
            return (
              <span
                key={m}
                className={cn(
                  'absolute',
                  i === 0 ? 'left-0' : edge ? 'right-0' : '-translate-x-1/2',
                )}
                style={edge ? undefined : { left: `${axis.x(m)}%` }}
              >
                {format.time(m)}
              </span>
            )
          })}
        </div>
      </div>
      {untimed}
    </Panel>
  )
}
