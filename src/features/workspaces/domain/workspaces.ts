/**
 * Przestrzenie: osobne zestawy projektów, sprintów, ustawień i wpisów pod jednym kontem
 * (np. dwóch pracodawców). Reguły wspólne dla serwera, API i interfejsu.
 */

/** Ciasteczko z bieżącą przestrzenią tej przeglądarki (każde urządzenie pamięta własną). */
export const WORKSPACE_COOKIE = 'app_ws'

export const WORKSPACE_NAME_MAX = 40

/**
 * Rzeczy, które można zmienić od razu we wszystkich przestrzeniach albo skopiować do innej.
 * Projekty, szablony i wpisy zawsze należą do jednej przestrzeni.
 */
export const APPLY_KINDS = [
  'daysOff',
  'sprints',
  'workTypes',
  'statuses',
  'tags',
  'storyPoints',
  'workday',
] as const
export type ApplyKind = (typeof APPLY_KINDS)[number]

/** 'ask' = pytaj przy każdej zmianie, 'this' = tylko bieżąca, 'all' = wszystkie przestrzenie. */
export const APPLY_PREFERENCES = ['ask', 'this', 'all'] as const
export type ApplyPreference = (typeof APPLY_PREFERENCES)[number]
export type ApplyTarget = Exclude<ApplyPreference, 'ask'>
export type ApplyPreferences = Partial<Record<ApplyKind, ApplyPreference>>

export const isApplyKind = (value: unknown): value is ApplyKind =>
  (APPLY_KINDS as ReadonlyArray<unknown>).includes(value)

export const isApplyTarget = (value: unknown): value is ApplyTarget =>
  value === 'this' || value === 'all'

/** Zapisany wybór dla rodzaju zmian; brak = pytaj. */
export const applyPreference = (
  prefs: ApplyPreferences,
  kind: ApplyKind,
): ApplyPreference => prefs[kind] ?? 'ask'

/**
 * Gdzie trafi zmiana bez pytania. Jedna przestrzeń = zawsze tylko ta; 'ask' zwraca null,
 * czyli trzeba zapytać.
 */
export function resolveApply(
  prefs: ApplyPreferences,
  kind: ApplyKind,
  workspaceCount: number,
): ApplyTarget | null {
  const isSingleWorkspace = workspaceCount <= 1
  if (isSingleWorkspace) return 'this'
  const preference = applyPreference(prefs, kind)
  return preference === 'ask' ? null : preference
}

/** Co można skopiować z innej przestrzeni (przy tworzeniu albo później z ustawień). */
export const COPY_KINDS = [
  'workTypes',
  'statuses',
  'storyPoints',
  'tags',
  'templates',
  'workday',
  'sprints',
  'daysOff',
] as const
export type CopyKind = (typeof COPY_KINDS)[number]

/** Domyślny zestaw kopiowany do nowej przestrzeni: konfiguracja, bez kalendarza. */
export const DEFAULT_COPY: ReadonlyArray<CopyKind> = [
  'workTypes',
  'statuses',
  'storyPoints',
  'tags',
  'templates',
  'workday',
]

export const isCopyKind = (value: unknown): value is CopyKind =>
  (COPY_KINDS as ReadonlyArray<unknown>).includes(value)

/** Szablony wskazują rodzaje pracy, więc bez nich kopiują się tylko te, które pasują nazwą. */
export const copyNeeds = (kinds: ReadonlyArray<CopyKind>) =>
  kinds.includes('templates') && !kinds.includes('workTypes')
    ? [...kinds, 'workTypes' as const]
    : [...kinds]

export const defaultWorkspaceName = (locale: 'en' | 'pl') =>
  locale === 'pl' ? 'Moja przestrzeń' : 'My workspace'

export interface WorkspaceRef {
  id: string
  name: string
}

/** Skrót klawiszowy przestrzeni na liście (pierwsze dziewięć): Alt+Shift+1…9. */
export const workspaceShortcut = (index: number) =>
  index >= 0 && index < 9 ? `Alt+Shift+${index + 1}` : null

/** Przestrzeń dla skrótu Alt+Shift+cyfra (cyfra 1–9). */
export const workspaceForDigit = <T>(list: ReadonlyArray<T>, digit: number) =>
  digit >= 1 && digit <= 9 ? (list[digit - 1] ?? null) : null

/** Pierwsze wejście danego dnia z kilkoma przestrzeniami: zapytać, w czym dziś pracujesz. */
export interface AskTodayInput {
  workspaceCount: number
  askDaily: boolean
  /** Dzień ostatniego wyboru na tym urządzeniu (YYYY-MM-DD) albo null. */
  pickedOn: string | null
  today: string
}

export function shouldAskToday(input: AskTodayInput) {
  return (
    input.workspaceCount > 1 && input.askDaily && input.pickedOn !== input.today
  )
}

/** Unikalna nazwa kopii: „Acme (2)”, „Acme (3)”… */
export function uniqueName(name: string, taken: ReadonlyArray<string>) {
  const used = new Set(
    taken.map((existingName) => existingName.trim().toLowerCase()),
  )
  const base = name.trim().slice(0, WORKSPACE_NAME_MAX)
  const isBaseFree = !used.has(base.toLowerCase())
  if (isBaseFree) return base
  for (let index = 2; ; index++) {
    const suffix = ` (${index})`
    const candidate = base.slice(0, WORKSPACE_NAME_MAX - suffix.length) + suffix
    const isCandidateFree = !used.has(candidate.toLowerCase())
    if (isCandidateFree) return candidate
  }
}
