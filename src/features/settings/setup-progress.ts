import { useSyncExternalStore } from 'react'
import { getCurrentUser } from '#/features/auth/session'

/**
 * Lista kroków "na start": krok, który nie wynika z danych (np. przejrzana skala SP),
 * odhaczamy po pierwszym zapisie w danej sekcji. To wygoda per przeglądarka, więc localStorage.
 */
export type SetupStep =
  'workday' | 'sprints' | 'storyPoints' | 'workTypes' | 'templates'

const listeners = new Set<() => void>()
const key = () => `setup:${getCurrentUser()?.id ?? 'anon'}`

function read(): Array<SetupStep> {
  try {
    return JSON.parse(
      window.localStorage.getItem(key()) ?? '[]',
    ) as Array<SetupStep>
  } catch {
    return []
  }
}

let cache: { key: string; raw: string; value: Array<SetupStep> } | null = null

function snapshot(): Array<SetupStep> {
  let raw = '[]'
  try {
    raw = window.localStorage.getItem(key()) ?? '[]'
  } catch {
    /* zablokowany storage */
  }
  if (cache && cache.key === key() && cache.raw === raw) return cache.value
  cache = { key: key(), raw, value: read() }
  return cache.value
}

export function markSetupStep(step: SetupStep) {
  const steps = read()
  if (steps.includes(step)) return
  try {
    window.localStorage.setItem(key(), JSON.stringify([...steps, step]))
  } catch {
    /* zablokowany storage: krok po prostu nie zostanie zapamiętany */
  }
  listeners.forEach((l) => l())
}

export function useSetupSteps(): ReadonlyArray<SetupStep> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot,
    () => [],
  )
}
