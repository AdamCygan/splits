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
import { persistConsent } from '../data/consent'
import type { Consent } from '../domain/consent'

interface ConsentState {
  consent: Consent | null
  settingsOpen: boolean
  save: (value: Consent) => void
  openSettings: () => void
  closeSettings: () => void
}

const Context = createContext<ConsentState | null>(null)

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
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useConsent() {
  const context = useContext(Context)
  if (!context) throw new Error('useConsent poza ConsentProvider')
  return context
}
