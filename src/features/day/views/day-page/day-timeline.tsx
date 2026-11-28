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
  viewModel: DayViewModel
}

/**
 * Oś dnia: sesje w kolorze rodzaju pracy, przerwy w paski. Mysz albo strzałki wybierają
 * odcinek (dymek ze szczegółami), kliknięcie albo Enter otwiera zadanie.
 */
export function DayTimeline({ viewModel }: DayTimelineProps) {
  const messages = useMessages(dayViewMessages).timeline
  const format = useFormat()
  const [active, setActive] = useState<number | null>(null)
  const liveId = useId()
  const { blocks, span, untimedMinutes } = viewModel.summary
  const untimed = untimedMinutes > 0 && (
    <p className={cn('text-sm text-ink-soft', span ? 'mt-3' : 'mt-1')}>
      {fmt(messages.untimed, { time: format.minutes(untimedMinutes) })}
    </p>
  )

  if (!span)
    return (
      <Panel title={messages.title} lead={messages.lead}>
        <p className="text-sm text-ink-soft">{messages.noTimes}</p>
        {untimed}
      </Panel>
    )

  const axis = timelineAxis(span)
  const used = stackOrder(
    viewModel.types.filter((type) =>
      blocks.some((dayBlock) => dayBlock.taskTypeId === type.id),
    ),
  )
  const labelOf = (dayBlock: DayBlock) =>
    fmt(messages.block, {
      name:
        dayBlock.kind === 'break'
          ? messages.break
          : `${viewModel.typeOf(dayBlock.taskTypeId)?.name ?? ''}: ${dayBlock.title}`,
      from: format.time(dayBlock.start),
      to: format.time(dayBlock.end),
      time: format.minutes(dayBlock.minutes),
    })
  const minuteAt = (mouseEvent: MouseEvent<HTMLElement>) => {
    const box = mouseEvent.currentTarget.getBoundingClientRect()
    return axis.at((mouseEvent.clientX - box.left) / box.width)
  }
  const current = active !== null ? blocks[active] : undefined

  return (
    <Panel title={messages.title} lead={messages.lead} className="mt-6">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {used.map((workType) => (
          <li key={workType.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: workType.color }}
            />
            {workType.name}
          </li>
        ))}
        {blocks.some((dayBlock) => dayBlock.kind === 'break') && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full border border-ink-faint"
              style={{ background: BREAK_FILL }}
            />
            {messages.break}
          </li>
        )}
      </ul>
      <div className="relative pt-1">
        <div
          role="group"
          tabIndex={0}
          aria-label={messages.keys}
          aria-describedby={liveId}
          className="relative h-14 cursor-pointer rounded-md bg-muted outline-offset-4"
          onPointerMove={(event) => {
            const blockIndexAtItem = blockIndexAt(blocks, minuteAt(event))
            setActive(blockIndexAtItem === -1 ? null : blockIndexAtItem)
          }}
          onPointerLeave={() => setActive(null)}
          // Odcinek pod kursorem (także przy dotyku, gdzie nie ma najechania).
          onClick={(event) =>
            viewModel.openBlock(blocks[blockIndexAt(blocks, minuteAt(event))])
          }
          onFocus={() => setActive((previousIndex) => previousIndex ?? 0)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            const move =
              event.key === 'ArrowRight'
                ? 1
                : event.key === 'ArrowLeft'
                  ? -1
                  : 0
            if (move)
              setActive((previousIndex) =>
                Math.min(
                  blocks.length - 1,
                  Math.max(0, (previousIndex ?? -1) + move),
                ),
              )
            else if (event.key === 'Home') setActive(0)
            else if (event.key === 'End') setActive(blocks.length - 1)
            else if (event.key === 'Enter' || event.key === ' ')
              viewModel.openBlock(current)
            else return
            event.preventDefault()
          }}
        >
          {blocks.map((dayBlock, index) => (
            <span
              key={dayBlock.id}
              aria-hidden
              className={cn(
                'pointer-events-none absolute border-x border-surface',
                dayBlock.kind === 'break'
                  ? 'inset-y-3 rounded-sm'
                  : 'inset-y-0',
                active === index && 'z-10 ring-2 ring-ink ring-offset-1',
              )}
              style={{
                left: `${axis.x(dayBlock.start)}%`,
                width: `max(3px, ${axis.x(dayBlock.end) - axis.x(dayBlock.start)}%)`,
                background:
                  dayBlock.kind === 'break'
                    ? BREAK_FILL
                    : viewModel.colorOf(dayBlock.taskTypeId),
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
              {current.kind === 'break' ? messages.break : current.title}
            </p>
            <p className="mt-0.5 text-ink-soft tabular-nums">
              {format.timeRange(current.start, current.end)},{' '}
              {format.minutes(current.minutes)}
            </p>
            {current.kind === 'work' && (
              <p className="mt-0.5 text-ink-soft">{messages.open}</p>
            )}
          </div>
        )}
        <div
          aria-hidden
          className="relative mt-1.5 h-4 text-xs text-ink-soft tabular-nums"
        >
          {axis.ticks.map((tick, index) => {
            const edge = index === 0 || index === axis.ticks.length - 1
            return (
              <span
                key={tick}
                className={cn(
                  'absolute',
                  index === 0
                    ? 'left-0'
                    : edge
                      ? 'right-0'
                      : '-translate-x-1/2',
                )}
                style={edge ? undefined : { left: `${axis.x(tick)}%` }}
              >
                {format.time(tick)}
              </span>
            )
          })}
        </div>
      </div>
      {untimed}
    </Panel>
  )
}
