import { useSyncExternalStore } from 'react'
import { data } from '#/data'
import type { AuthSession, User } from '#/data/types'
import { identify, resetAnalytics } from '#/integrations/posthog/analytics'
import { setUnauthorizedHandler } from '#/lib/api-client'
import { onAccessTokenChange, setAccessToken } from '#/lib/auth-token'

/**
 * Sesja po stronie przeglądarki:
 *  - access token (15 min) w pamięci, refresh token w ciasteczku httpOnly (tryb api),
 *  - w trybie demo sesja jest w localStorage,
 *  - po 401 api-client raz odświeża sesję i powtarza żądanie.
 */
let currentUser: User | null = null
let refreshing: Promise<boolean> | null = null
const userListeners = new Set<() => void>()
const expiredListeners = new Set<() => void>()

/**
 * Sesja wygasła w trakcie pracy (odświeżenie po 401 się nie udało, a użytkownik był
 * zalogowany). Panel na to wylogowuje i przekierowuje na logowanie.
 */
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

function notify() {
  userListeners.forEach((listener) => listener())
}

export function startSession(auth: AuthSession) {
  currentUser = auth.user
  setAccessToken(auth.accessToken)
  identify(auth.user.id, { plan: auth.user.plan })
  notify()
}

export function setCurrentUser(user: User) {
  currentUser = user
  notify()
}

export function clearSession() {
  currentUser = null
  setAccessToken(null)
  resetAnalytics()
  notify()
}

export const getCurrentUser = () => currentUser

/** Jedno odświeżenie naraz, nawet gdy kilka zapytań dostanie 401 równocześnie. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= data.auth
    .restore()
    .then((result) => {
      if (result.ok) {
        startSession(result.value)
        return true
      }
      const wasSignedIn = currentUser !== null
      clearSession()
      if (wasSignedIn) expiredListeners.forEach((listener) => listener())
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** Dla beforeLoad chronionych tras: true = użytkownik zalogowany. */
export async function ensureSession(): Promise<boolean> {
  if (currentUser) return true
  return refreshSession()
}

export async function signOut() {
  await data.auth.logout()
  clearSession()
}

setUnauthorizedHandler(refreshSession)

function subscribe(listener: () => void) {
  userListeners.add(listener)
  const off = onAccessTokenChange(listener)
  return () => {
    userListeners.delete(listener)
    off()
  }
}

export function useCurrentUser(): User | null {
  return useSyncExternalStore(
    subscribe,
    () => currentUser,
    () => null,
  )
}
