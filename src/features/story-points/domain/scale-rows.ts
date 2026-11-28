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
  steps.map((step) => ({
    key: nextRowKey(),
    points: String(step.points),
    hours: String(Math.floor(step.maxMinutes / 60)),
    minutes: String(step.maxMinutes % 60),
  }))

export const parseRow = (row: Row) => ({
  points: Number(row.points.replace(',', '.')),
  maxMinutes: Math.round(
    (Number(row.hours || 0) || 0) * 60 + (Number(row.minutes || 0) || 0),
  ),
})
