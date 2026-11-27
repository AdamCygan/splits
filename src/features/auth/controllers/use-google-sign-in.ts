import { useEffect, useState } from 'react'
import { authApi } from '../data/api'

/** Czy serwer ma skonfigurowane logowanie Google (GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET). */
export function useGoogleAvailable() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    void authApi.providers().then((result) => {
      if (active) setEnabled(result.ok && result.value.google)
    })
    return () => {
      active = false
    }
  }, [])
  return enabled
}

/** Adres startu logowania Google z powrotem na `redirectTo` i strefą czasową przeglądarki. */
export const googleSignInUrl = (redirectTo?: string) =>
  `/api/v1/auth/google?${new URLSearchParams({
    redirect: redirectTo ?? '/app',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }).toString()}`
