/**
 * Nonce z nagłówka Content-Security-Policy bieżącego żądania (tylko serwer).
 * Serwer (src/server.ts) trzyma go w AsyncLocalStorage i rejestruje tu przez globalThis,
 * żeby router nie importował modułów Node do paczki przeglądarki.
 * W przeglądarce zawsze undefined: skrypty dodane po załadowaniu strony nonce'a nie potrzebują.
 */
interface NonceStore {
  getStore: () => string | undefined
}

const KEY = Symbol.for('pointhours.cspNonce')

type WithNonceStore = typeof globalThis & { [KEY]?: NonceStore }

export function registerNonceStore(store: NonceStore) {
  ;(globalThis as WithNonceStore)[KEY] = store
}

export function currentNonce(): string | undefined {
  if (typeof window !== 'undefined') return undefined
  return (globalThis as WithNonceStore)[KEY]?.getStore()
}
