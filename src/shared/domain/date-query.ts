import { foldText, pad2 as pad } from './text'
import { addDays, isValidDate } from './dates'

/**
 * Dzień wpisany w palecie poleceń: „dziś”/„today”, „wczoraj”/„yesterday”,
 * „przedwczoraj”, 2026-11-20, 20.11 albo 20.11.2026. Bez przyszłych dni (nie ma w nich
 * przepracowanego czasu); null, gdy tekst nie jest datą.
 */
export function parseDateQuery(raw: string, today: string): string | null {
  const q = foldText(raw.trim())
  if (!q) return null
  const words: Partial<Record<string, number>> = {
    today: 0,
    dzis: 0,
    dzisiaj: 0,
    yesterday: -1,
    wczoraj: -1,
    przedwczoraj: -2,
  }
  const offset = words[q]
  if (offset !== undefined) return addDays(today, offset)
  let date: string | null = null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q)
  const dotted = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\.?$/.exec(q)
  if (iso) date = `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`
  else if (dotted) {
    const year = dotted[3] ?? today.slice(0, 4)
    date = `${year}-${pad(Number(dotted[2]))}-${pad(Number(dotted[1]))}`
    // 20.12 w styczniu to grudzień zeszłego roku, nie przyszłość.
    if (!dotted[3] && isValidDate(date) && date > today)
      date = `${Number(year) - 1}${date.slice(4)}`
  }
  if (!date || !isValidDate(date) || date > today) return null
  return date
}
