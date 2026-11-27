import { ACCESS_TOKEN_MINUTES } from './tokens.server'

/**
 * Natychmiastowe odcięcie dostępu po zablokowaniu albo usunięciu konta.
 * Access token (JWT) jest ważny do 15 minut i nie da się go cofnąć, więc pamiętamy
 * odcięte konta przez ten czas. Refresh tokeny są unieważniane w bazie, dlatego po 15 minutach
 * lista nie jest już potrzebna. Przy kilku maszynach inne maszyny odetną konto najpóźniej po 15 minutach.
 */
const cutOff = new Map<string, number>()

export function cutAccess(userId: string) {
  cutOff.set(userId, Date.now() + ACCESS_TOKEN_MINUTES * 60_000)
}

export function restoreAccess(userId: string) {
  cutOff.delete(userId)
}

export function isCutOff(userId: string) {
  const until = cutOff.get(userId)
  if (until === undefined) return false
  if (until > Date.now()) return true
  cutOff.delete(userId)
  return false
}
