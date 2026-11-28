/** Udział `part` w `total` w pełnych procentach (0, gdy `total` ≤ 0). `cap` przycina do 100. */
export function percentOf(part: number, total: number, limit = false) {
  const isEmptyTotal = total <= 0
  if (isEmptyTotal) return 0
  const value = Math.round((part / total) * 100)
  return limit ? Math.min(100, value) : value
}

/** Największa znana wartość (null pomijane); null, gdy nie ma żadnej. */
export function maxOf(values: ReadonlyArray<number | null | undefined>) {
  const known = values.filter(
    (part): part is number => part !== null && part !== undefined,
  )
  return known.length ? Math.max(...known) : null
}
