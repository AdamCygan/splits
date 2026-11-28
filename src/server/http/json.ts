/** Wiersze z bazy → kształt z kontraktu API (src/data/types.ts), daty jako ISO 8601. */
/** Data z bazy jako ISO 8601 albo null (format dat w odpowiedziach API). */
export const isoDate = (date: Date | null) => (date ? date.toISOString() : null)
