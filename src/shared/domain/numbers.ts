/** Udział `part` w `total` w pełnych procentach (0, gdy `total` ≤ 0). `cap` przycina do 100. */
export function percentOf(part: number, total: number, cap = false) {
  if (total <= 0) return 0
  const value = Math.round((part / total) * 100)
  return cap ? Math.min(100, value) : value
}

/** Największa znana wartość (null pomijane); null, gdy nie ma żadnej. */
export function maxOf(values: ReadonlyArray<number | null | undefined>) {
  const known = values.filter((v): v is number => v !== null && v !== undefined)
  return known.length ? Math.max(...known) : null
}
