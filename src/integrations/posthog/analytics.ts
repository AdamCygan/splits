import type { PostHog } from 'posthog-js'
import { environment } from '#/lib/env'

/**
 * Analityka produktowa (PostHog), ładowana leniwie:
 *  - wyłącznie po zgodzie na statystyki w banerze cookies (features/legal),
 *  - bez VITE_POSTHOG_KEY nic się nie pobiera,
 *  - z kluczem posthog-js (~60 KB gz) dociąga się dopiero, gdy przeglądarka jest bezczynna,
 *    więc nie spowalnia pierwszego wyświetlenia strony.
 * Zdarzenia wysłane przed załadowaniem trafiają do kolejki.
 */
let client: PostHog | null = null
let started = false
const queue: Array<(posthog: PostHog) => void> = []

export function initAnalytics() {
  const cannotStart =
    started || typeof window === 'undefined' || !environment.VITE_POSTHOG_KEY
  if (cannotStart) return
  started = true

  const load = async () => {
    const { default: posthog } = await import('posthog-js')
    posthog.init(environment.VITE_POSTHOG_KEY!, {
      api_host: environment.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: 'history_change',
      defaults: '2025-11-30',
    })
    const hasOptedOut = posthog.has_opted_out_capturing()
    if (hasOptedOut) posthog.opt_in_capturing()
    client = posthog
    queue.splice(0).forEach((callback) => callback(posthog))
  }

  const hasIdleCallback = 'requestIdleCallback' in window
  if (hasIdleCallback) {
    window.requestIdleCallback(() => void load(), { timeout: 4000 })
  } else {
    setTimeout(() => void load(), 2000)
  }
}

function withClient(callback: (posthog: PostHog) => void) {
  if (client) callback(client)
  else if (started) queue.push(callback)
}

/** Zdarzenie produktowe, np. track('signup_completed', { plan: 'free' }). */
export function track(event: string, properties?: Record<string, unknown>) {
  withClient((posthog) => posthog.capture(event, properties))
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  withClient((posthog) => posthog.identify(userId, properties))
}

/** Wycofanie zgody: przestajemy zbierać i usuwamy cookies/localStorage PostHoga. */
export function disableAnalytics() {
  if (client) {
    client.opt_out_capturing()
    client.reset()
  }
  queue.length = 0
  started = false
  client = null
  const hasDocument = typeof document !== 'undefined'
  if (hasDocument) {
    for (const part of document.cookie.split('; ')) {
      const name = part.split('=')[0] ?? ''
      const isPosthogCookie = name.startsWith('ph_')
      if (isPosthogCookie) document.cookie = `${name}=; Path=/; Max-Age=0`
    }
    try {
      for (const key of Object.keys(window.localStorage)) {
        const isPosthogKey = key.startsWith('ph_')
        if (isPosthogKey) window.localStorage.removeItem(key)
      }
    } catch {
      /* storage zablokowany: nic do usunięcia */
    }
  }
}

export function resetAnalytics() {
  withClient((posthog) => posthog.reset())
}
