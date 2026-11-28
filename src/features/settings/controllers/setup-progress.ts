import { useSyncExternalStore } from 'react'
import { getCurrentUser } from '#/features/auth/data/session'

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
  const cached = cache
  const isCached = cached && cached.key === key() && cached.raw === raw
  if (isCached) return cached.value
  cache = { key: key(), raw, value: read() }
  return cache.value
}

export function markSetupStep(step: SetupStep) {
  const steps = read()
  const isDone = steps.includes(step)
  if (isDone) return
  try {
    window.localStorage.setItem(key(), JSON.stringify([...steps, step]))
  } catch {
    /* zablokowany storage: krok po prostu nie zostanie zapamiętany */
  }
  listeners.forEach((listener) => listener())
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
