/**
 * Kolory typów pracy — te same na landing page, w formularzu, w filmie i w analityce.
 * Kolor w interfejsie Timeblame oznacza zawsze rodzaj pracy, nigdy dekorację.
 * Nazwy typów są w słowniku (i18n/messages/common.ts → workTypes).
 */
export type WorkKind =
  | 'task'
  | 'code_review'
  | 'pair_programming'
  | 'additional_work'
  | 'meeting'
  | 'custom'

export const workKindOrder: ReadonlyArray<WorkKind> = [
  'task',
  'code_review',
  'pair_programming',
  'additional_work',
  'meeting',
  'custom',
]

/**
 * Domyślnie: zadania zawsze z SP, code review, pair programming i prace dodatkowe z SP opcjonalnymi,
 * spotkania bez SP. Użytkownik zmienia to w ustawieniach typu pracy.
 */
export const defaultSpRequirement: Record<
  WorkKind,
  'hidden' | 'optional' | 'required'
> = {
  task: 'required',
  code_review: 'optional',
  pair_programming: 'optional',
  additional_work: 'optional',
  meeting: 'hidden',
  custom: 'optional',
}

export const workKindColors: Record<WorkKind, { color: string; ink: string }> =
  {
    task: { color: 'var(--wt-task)', ink: '#ffffff' },
    code_review: { color: 'var(--wt-review)', ink: 'var(--ink)' },
    pair_programming: { color: 'var(--wt-pair)', ink: '#ffffff' },
    additional_work: { color: 'var(--wt-extra)', ink: '#ffffff' },
    meeting: { color: 'var(--wt-meeting)', ink: '#ffffff' },
    custom: { color: 'var(--wt-custom)', ink: '#ffffff' },
  }

/** Domyślna skala SP (konfigurowalna przez użytkownika). */
export const defaultSpScale: ReadonlyArray<{
  points: number
  maxMinutes: number
}> = [
  { points: 0.5, maxMinutes: 30 },
  { points: 1, maxMinutes: 60 },
  { points: 2, maxMinutes: 120 },
  { points: 3, maxMinutes: 240 },
  { points: 5, maxMinutes: 480 },
  { points: 8, maxMinutes: 960 },
  { points: 13, maxMinutes: 1920 },
]
