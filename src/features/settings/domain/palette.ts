import { PALETTE } from '#/features/task-types/domain/rules'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'

/** Kolory palety z nazwami w języku użytkownika (dla ColorPicker i czytników ekranu). */
export function usePalette() {
  const names = useMessages(settingsMessages).colors
  return PALETTE.map((p) => ({ value: p.value, label: names[p.name] }))
}

/** Jeśli zapisany kolor spoza palety — dokładamy go, żeby nie zniknął z wyboru. */
export function withCurrent(
  swatches: ReturnType<typeof usePalette>,
  current: string,
) {
  return swatches.some((s) => s.value.toLowerCase() === current.toLowerCase())
    ? swatches
    : [...swatches, { value: current, label: current }]
}
