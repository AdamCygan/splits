export function move<T>(
  list: ReadonlyArray<T>,
  from: number,
  to: number,
): Array<T> {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item!)
  return copy
}
