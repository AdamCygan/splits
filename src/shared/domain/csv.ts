/** Komórka CSV: cudzysłowy, gdy trzeba, i ochrona przed formułami w arkuszu. */
export function csvCell(value: string | number | boolean | null) {
  const text = value === null ? '' : String(value)
  // Formuły w arkuszu (=, +, -, @) neutralizujemy apostrofem, żeby tekst nie wykonał się w Excelu.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Wiersze jako CSV (RFC 4180: przecinki, CRLF, nowa linia na końcu). */
export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>,
) {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}
