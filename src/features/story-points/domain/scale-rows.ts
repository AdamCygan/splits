import type { SpScaleStep } from '#/features/story-points/data/dto'

/** Klucz React dla nowego wiersza edytora (rośnie przez całą sesję). */
let rowKey = 0
export const nextRowKey = () => ++rowKey

export interface Row {
  key: number
  points: string
  hours: string
  minutes: string
}

export const toRows = (
  steps: ReadonlyArray<Pick<SpScaleStep, 'points' | 'maxMinutes'>>,
): Array<Row> =>
  steps.map((s) => ({
    key: nextRowKey(),
    points: String(s.points),
    hours: String(Math.floor(s.maxMinutes / 60)),
    minutes: String(s.maxMinutes % 60),
  }))

export const parseRow = (r: Row) => ({
  points: Number(r.points.replace(',', '.')),
  maxMinutes: Math.round(
    (Number(r.hours || 0) || 0) * 60 + (Number(r.minutes || 0) || 0),
  ),
})
