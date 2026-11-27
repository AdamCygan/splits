/** Blok treści dokumentu prawnego. {nazwa} w tekście = wartość z config/legal.ts. */
export type LegalBlock =
  | string
  | { ul: Array<string> }
  | { ol: Array<string> }
  | { table: { head: Array<string>; rows: Array<Array<string>> } }

export interface LegalSection {
  id: string
  heading: string
  blocks: Array<LegalBlock>
}

export interface LegalDoc {
  title: string
  /** Krótki opis do meta description i nagłówka strony. */
  summary: string
  /** Data ostatniej aktualizacji, gdy dokument żyje własnym rytmem (np. deklaracja dostępności). */
  updated?: string
  sections: Array<LegalSection>
}

export type LegalDocId = 'terms' | 'privacy' | 'cookies' | 'accessibility'
