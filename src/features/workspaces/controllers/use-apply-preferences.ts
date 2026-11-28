import { APPLY_KINDS, applyPreference } from '../domain/workspaces'
import type { ApplyKind, ApplyPreference } from '../domain/workspaces'
import { useSavePrefs, useWorkspaces } from './use-workspaces'

/** Ustawienia: gdzie trafia każdy rodzaj zmian i czy pytać o przestrzeń na start dnia. */
export function useApplyPreferences() {
  const { prefs } = useWorkspaces()
  const save = useSavePrefs()
  return {
    rows: APPLY_KINDS.map((kind) => ({
      kind,
      value: applyPreference(prefs.apply, kind),
    })),
    set: (kind: ApplyKind, value: ApplyPreference) =>
      save.mutate({ apply: { [kind]: value } }),
    askDaily: prefs.askDaily,
    setAskDaily: (askDaily: boolean) => save.mutate({ askDaily }),
    saving: save.isPending,
  }
}
