import {
  defaultSpScale,
  workKindColors,
} from '#/features/task-types/domain/work-types'
import type { WorkKind } from '#/features/task-types/domain/work-types'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDateRange } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { marketingMessages } from '#/i18n/messages/marketing'

/** Przykładowe podsumowanie sprintu: SP i godziny per rodzaj pracy. */
const sprint: Array<{
  kind: WorkKind
  sp: number
  minutes: number
  items: number
}> = [
  { kind: 'task', sp: 21, minutes: 2280, items: 7 },
  { kind: 'code_review', sp: 6.5, minutes: 610, items: 13 },
  { kind: 'pair_programming', sp: 4, minutes: 420, items: 4 },
  { kind: 'additional_work', sp: 2.5, minutes: 330, items: 5 },
  { kind: 'meeting', sp: 3, minutes: 540, items: 12 },
]

const totalMinutes = sprint.reduce((a, r) => a + r.minutes, 0)
const totalSp = sprint.reduce((a, r) => a + r.sp, 0)

export function SprintBreakdown() {
  const t = useMessages(marketingMessages).sprintDemo
  const workTypes = useMessages(commonMessages).workTypes
  const format = useFormat()
  const { locale } = useI18n()

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-heading text-2xl">{t.name}</p>
        <p className="text-sm text-ink-soft">
          {formatDateRange(locale, '2025-11-03', '2025-11-14')}, {t.workingDays}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:max-w-sm">
        <div>
          <dt className="text-sm text-ink-soft">{t.completed}</dt>
          <dd className="type-heading text-4xl">{format.sp(totalSp)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{t.logged}</dt>
          <dd className="type-heading text-4xl">
            {format.minutes(totalMinutes)}
          </dd>
        </div>
      </dl>

      <div
        className="mt-6 flex h-4 gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={t.breakdownLabel}
      >
        {sprint.map((r) => (
          <div
            key={r.kind}
            style={{
              width: `${(r.minutes / totalMinutes) * 100}%`,
              background: workKindColors[r.kind].color,
            }}
          />
        ))}
      </div>

      <table className="mt-6 w-full text-left text-sm tabular-nums">
        <thead className="text-ink-soft">
          <tr>
            <th scope="col" className="pb-2 font-normal">
              {t.headers.type}
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              {t.headers.entries}
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              {t.headers.sp}
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              {t.headers.time}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {sprint.map((r) => (
            <tr key={r.kind}>
              <th scope="row" className="py-2 font-normal">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm"
                    style={{ background: workKindColors[r.kind].color }}
                  />
                  {workTypes[r.kind]}
                </span>
              </th>
              <td className="py-2 text-right text-ink-soft">{r.items}</td>
              <td className="py-2 text-right font-medium">
                {format.number(r.sp)}
              </td>
              <td className="py-2 text-right">{format.minutes(r.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Linijka skali SP: wartość i górny limit czasu. */
export function SpScaleRuler() {
  const t = useMessages(marketingMessages).sprintDemo
  const format = useFormat()
  return (
    <ol className="grid grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line">
      {defaultSpScale.map((s) => (
        <li key={s.points} className="bg-surface px-3 py-3">
          <p className="type-heading text-2xl">{format.number(s.points)}</p>
          <p className="text-sm text-ink-soft">
            {fmt(t.upTo, { time: format.minutes(s.maxMinutes) })}
          </p>
        </li>
      ))}
    </ol>
  )
}
