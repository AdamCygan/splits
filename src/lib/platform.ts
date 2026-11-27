/** Mac, iPhone albo iPad: skróty z ⌘ zamiast Ctrl. Bezpieczne przy SSR (false). */
export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

/** Nazwa klawisza modyfikatora do podpisów skrótów: „⌘” na Apple, „Ctrl” gdzie indziej. */
export const modifierKey = () => (isApplePlatform() ? '⌘' : 'Ctrl')
