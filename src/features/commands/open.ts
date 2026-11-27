import { isApplePlatform } from '#/lib/platform'

export const OPEN_EVENT = 'ph:command-palette'

/** Podpis skrótu: ⌘K na Macu, Ctrl K gdzie indziej. */
export const shortcutLabel = () => (isApplePlatform() ? '⌘K' : 'Ctrl K')

/** Otwiera paletę z dowolnego miejsca (np. z menu konta). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}
