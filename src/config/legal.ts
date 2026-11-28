import { site } from './site'

/**
 * Dane do dokumentów prawnych (regulamin, polityka prywatności, cookies).
 *
 * PRZED PUBLIKACJĄ uzupełnij pola w nawiasach kwadratowych danymi z CEIDG / KRS
 * i daj teksty do przejrzenia prawnikowi. Dokumenty pokazują te wartości dosłownie,
 * więc brak danych będzie widoczny na stronie.
 */
export const legal = {
  /** Data wejścia w życie bieżącej wersji dokumentów (YYYY-MM-DD). */
  effectiveDate: '2026-11-06',
  version: '1.1',
  operator: {
    name: '[Imię i nazwisko albo nazwa firmy]',
    address: '[ulica i numer, kod pocztowy, miasto, Polska]',
    /** NIP, REGON i rejestr: wpis w CEIDG albo KRS z numerem. */
    ids: '[NIP: …, REGON: …, wpis do CEIDG / KRS nr …]',
  },
  email: {
    support: site.supportEmail,
    privacy: 'privacy@example.com',
  },
  /** Podmioty przetwarzające dane (dostosuj do faktycznie używanych usług). */
  processors: {
    /** Region usługi sprawdzisz w Railway: Service → Settings → Regions. */
    hosting:
      'Railway Corporation (USA), serwery w regionie [region z Railway, np. EU West – Amsterdam]',
    database:
      'Railway Corporation (PostgreSQL w tym samym regionie co aplikacja)',
    email: 'Resend (USA)',
  },
  /** Ile dni kopie zapasowe przechowują dane po usunięciu konta. */
  backupRetentionDays: 30,
  /** Ile dni trzymamy logi serwera (adres IP, przeglądarka) dla bezpieczeństwa. */
  logRetentionDays: 30,
} as const

export const LEGAL_PLACEHOLDERS = Object.freeze({
  name: site.name,
  url: site.url,
  operator: legal.operator.name,
  address: legal.operator.address,
  ids: legal.operator.ids,
  email: legal.email.support,
  privacyEmail: legal.email.privacy,
  hosting: legal.processors.hosting,
  database: legal.processors.database,
  mail: legal.processors.email,
  backupDays: String(legal.backupRetentionDays),
  logDays: String(legal.logRetentionDays),
})
