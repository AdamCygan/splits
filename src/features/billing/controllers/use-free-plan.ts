import { useCurrentUser } from '#/features/auth/data/session'
import { hasProAccess } from '../domain/plans'

/** Czy zalogowany użytkownik jest na planie Free (bez Pro i bez roli administratora). */
export function useFreePlan() {
  return !hasProAccess(useCurrentUser())
}
