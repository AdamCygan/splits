/**
 * Access token trzymany wyłącznie w pamięci (nie w localStorage — odporność na XSS).
 * Po odświeżeniu strony odzyskujemy go przez /auth/refresh (ciasteczko httpOnly).
 */
let accessToken: string | null = null
const listeners = new Set<() => void>()

export const getAccessToken = () => accessToken

export function setAccessToken(token: string | null) {
  accessToken = token
  listeners.forEach((listener) => listener())
}

export function onAccessTokenChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
