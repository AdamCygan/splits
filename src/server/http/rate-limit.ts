import { serverEnv } from '../env'
import { ApiError } from './errors'

/**
 * Prosty limit prób w pamięci procesu (jedna maszyna). Chroni logowanie, rejestrację
 * i reset hasła przed zgadywaniem; przy kilku maszynach przenieś to do Redisa albo bazy.
 */
const hits = new Map<string, Array<number>>()

export function rateLimit(key: string, max: number, windowMs: number) {
  if (!serverEnv.rateLimits) return
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter(
    (messages) => now - messages < windowMs,
  )
  if (recent.length >= max) throw new ApiError('auth.too_many_attempts', 429)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 10_000) {
    for (const [entryKey, list] of hits)
      if (list.every((timestamp) => now - timestamp >= windowMs))
        hits.delete(entryKey)
  }
}

export function resetRateLimit(key: string) {
  hits.delete(key)
}
