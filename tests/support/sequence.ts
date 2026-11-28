/**
 * Kolejne wywołania jedno po drugim (kolejność ma znaczenie: limity, blokada logowania),
 * bez pętli w treści testu. Zwraca wyniki w tej samej kolejności.
 */
export async function inSequence<TItem, TResult>(
  items: ReadonlyArray<TItem>,
  run: (item: TItem, index: number) => Promise<TResult>,
): Promise<Array<TResult>> {
  return items.reduce<Promise<Array<TResult>>>(
    async (done, item, index) => [...(await done), await run(item, index)],
    Promise.resolve([]),
  )
}

/** Liczby 1…count (numery kolejnych pozycji w testach). */
export const numbered = (count: number) =>
  Array.from({ length: count }, (_unused, index) => index + 1)
