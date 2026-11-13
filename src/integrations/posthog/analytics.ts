import type { PostHog } from 'posthog-js'
import { env } from '#/lib/env'

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
const queue: Array<(ph: PostHog) => void> = []

export function initAnalytics() {
  if (started || typeof window === 'undefined' || !env.VITE_POSTHOG_KEY) return
  started = true

  const load = async () => {
    const { default: posthog } = await import('posthog-js')
    posthog.init(env.VITE_POSTHOG_KEY!, {
      api_host: env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: 'history_change',
      defaults: '2025-11-30',
    })
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()
    client = posthog
    queue.splice(0).forEach((fn) => fn(posthog))
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => void load(), { timeout: 4000 })
  } else {
    setTimeout(() => void load(), 2000)
  }
}

function withClient(fn: (ph: PostHog) => void) {
  if (client) fn(client)
  else if (started) queue.push(fn)
}

/** Zdarzenie produktowe, np. track('signup_completed', { plan: 'free' }). */
export function track(event: string, properties?: Record<string, unknown>) {
  withClient((ph) => ph.capture(event, properties))
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  withClient((ph) => ph.identify(userId, properties))
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
  if (typeof document !== 'undefined') {
    for (const part of document.cookie.split('; ')) {
      const name = part.split('=')[0] ?? ''
      if (name.startsWith('ph_'))
        document.cookie = `${name}=; Path=/; Max-Age=0`
    }
    try {
      for (const key of Object.keys(window.localStorage))
        if (key.startsWith('ph_')) window.localStorage.removeItem(key)
    } catch {
      /* storage zablokowany: nic do usunięcia */
    }
  }
}

export function resetAnalytics() {
  withClient((ph) => ph.reset())
}
