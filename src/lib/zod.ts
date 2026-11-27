import { z } from 'zod'

/**
 * Zod do kodu przeglądarki. jitless: bez próby `new Function()` (szybsza walidacja przez
 * generowany kod), której i tak nie przepuszcza nasze Content-Security-Policy, a każda próba
 * zostawia w przeglądarce zgłoszenie naruszenia CSP.
 */
z.config({ jitless: true })

export { z }
