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
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) throw new ApiError('auth.too_many_attempts', 429)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 10_000) {
    for (const [k, list] of hits)
      if (list.every((t) => now - t >= windowMs)) hits.delete(k)
  }
}

export function resetRateLimit(key: string) {
  hits.delete(key)
}
