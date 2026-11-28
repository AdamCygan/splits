interface Archivable {
  id: string
  archivedAt: string | null
}

/** Aktywne i zarchiwizowane pozycje listy (rodzaje pracy, projekty, statusy). */
export function splitArchived<TItem extends Archivable>(
  items: ReadonlyArray<TItem>,
) {
  return {
    active: items.filter((archivable) => !archivable.archivedAt),
    archived: items.filter((archivable) => archivable.archivedAt),
  }
}

/**
 * Pozycje do wyboru w formularzu: aktywne plus ta, którą edytowany wpis już ma
 * (zarchiwizowany projekt nie znika z edycji starego wpisu).
 */
export const selectable = <TItem extends Archivable>(
  items: ReadonlyArray<TItem>,
  currentId?: string | null,
) =>
  items.filter(
    (archivable) => !archivable.archivedAt || archivable.id === currentId,
  )
