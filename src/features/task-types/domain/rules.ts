/**
 * Reguły walidacji wspólne dla formularzy, warstwy demo i (lustrzanie) API/bazy.
 * Zmiana tutaj = zmiana CHECK-ów w docs/database/schema.sql i walidatorów w .NET.
 */
export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
export const PROJECT_KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/
export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const LIMITS = {
  taskTypeName: 40,
  linkLabel: 40,
  statusName: 30,
  sprintName: 80,
  sprintGoal: 500,
  sprintLengthDays: { min: 1, max: 56 },
  projectName: 80,
  tagName: 30,
  templateLabel: 40,
  templateTitle: 200,
  templateDuration: { min: 1, max: 720 },
  displayName: 80,
  passwordMin: 10,
  passwordMax: 128,
  workdayMinutes: { min: 0, max: 1440 },
} as const

export const ROUNDING_OPTIONS = [0, 1, 5, 10, 15, 30] as const

/** Paleta kolorów do wyboru w panelu — nazwy dla czytników ekranu w słowniku. */
export const PALETTE = [
  { value: '#3D3BF3', name: 'indigo' },
  { value: '#2C8FD6', name: 'blue' },
  { value: '#0F9F86', name: 'teal' },
  { value: '#4C9A2A', name: 'green' },
  { value: '#E8A33D', name: 'amber' },
  { value: '#E5603B', name: 'orange' },
  { value: '#DB4A7C', name: 'pink' },
  { value: '#8B5CF6', name: 'violet' },
  { value: '#8A8FA8', name: 'slate' },
  { value: '#14162B', name: 'ink' },
] as const

export type PaletteName = (typeof PALETTE)[number]['name']

export const sameName = (name: string, otherName: string) =>
  name.trim().toLocaleLowerCase() === otherName.trim().toLocaleLowerCase()

/** Klucz zadania z linku: PAY-142 (Jira) albo !481 (GitLab MR) albo #123 (GitHub). */
export function extractTaskKey(url: string): string | null {
  const jira = url.match(/\b([A-Z][A-Z0-9]{1,9}-\d+)\b/)
  if (jira) return jira[1]!
  const mergeRequest = url.match(/merge_requests\/(\d+)/)
  if (mergeRequest) return `!${mergeRequest[1]}`
  const github = url.match(/\/(?:pull|issues)\/(\d+)/)
  if (github) return `#${github[1]}`
  return null
}
