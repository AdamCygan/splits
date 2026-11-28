import { useSyncExternalStore } from 'react'

/**
 * Mała preferencja tej przeglądarki w localStorage (motyw, format godziny): jedna z
 * dozwolonych wartości, z domyślną, która nie jest zapisywana. Bez localStorage (tryb
 * prywatny) wartość żyje w pamięci do odświeżenia. Komponenty czytają ją przez `use()`
 * i przerysowują się po `set()`.
 */
export function createLocalStore<T extends string>(
  key: string,
  values: ReadonlyArray<T>,
  fallback: T,
) {
  const listeners = new Set<() => void>()
  let memory: T = fallback

  const read = (): T => {
    try {
      const item = localStorage.getItem(key)
      return item !== null && (values as ReadonlyArray<string>).includes(item)
        ? (item as T)
        : fallback
    } catch {
      return memory
    }
  }

  const set = (value: T) => {
    memory = value
    try {
      if (value === fallback) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      // Bez localStorage zostaje wartość w pamięci.
    }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const use = (): T => useSyncExternalStore(subscribe, read, () => fallback)

  return { key, read, set, subscribe, use }
}
