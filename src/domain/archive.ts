type Archivable = { id: string; archivedAt: string | null }

/** Aktywne i zarchiwizowane pozycje listy (rodzaje pracy, projekty, statusy). */
export function splitArchived<TItem extends Archivable>(
  items: ReadonlyArray<TItem>,
) {
  return {
    active: items.filter((x) => !x.archivedAt),
    archived: items.filter((x) => x.archivedAt),
  }
}

/**
 * Pozycje do wyboru w formularzu: aktywne plus ta, którą edytowany wpis już ma
 * (zarchiwizowany projekt nie znika z edycji starego wpisu).
 */
export const selectable = <TItem extends Archivable>(
  items: ReadonlyArray<TItem>,
  currentId?: string | null,
) => items.filter((x) => !x.archivedAt || x.id === currentId)
