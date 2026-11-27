import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  disableAnalytics,
  initAnalytics,
} from '#/integrations/posthog/analytics'
import { persistConsent } from './consent'
import type { Consent } from './consent'

interface ConsentState {
  consent: Consent | null
  settingsOpen: boolean
  save: (value: Consent) => void
  openSettings: () => void
  closeSettings: () => void
}

const Ctx = createContext<ConsentState | null>(null)

export interface ConsentProviderProps {
  initial: Consent | null
  children: ReactNode
}

/**
 * Stan zgody na cookies dla całej aplikacji. Wartość startowa pochodzi z loadera
 * (ciasteczko czytane na serwerze), więc SSR i hydracja pokazują to samo.
 * Statystyki (PostHog) ładują się wyłącznie po zgodzie i wyłączają po jej wycofaniu.
 */
export function ConsentProvider({ initial, children }: ConsentProviderProps) {
  const [consent, setConsent] = useState(initial)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (consent === 'analytics') initAnalytics()
  }, [consent])

  const save = useCallback((value: Consent) => {
    persistConsent(value)
    if (value === 'necessary') disableAnalytics()
    setConsent(value)
    setSettingsOpen(false)
  }, [])

  const value = useMemo<ConsentState>(
    () => ({
      consent,
      settingsOpen,
      save,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [consent, settingsOpen, save],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConsent() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConsent poza ConsentProvider')
  return ctx
}
