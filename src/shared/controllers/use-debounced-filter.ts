import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Opóźniony zapis filtra w adresie strony (np. wyszukiwanie po wpisaniu). Jeśli w międzyczasie
 * użytkownik przeszedł na inną stronę (np. kliknął konto na liście), zapis się nie wykona,
 * więc spóźniona zmiana adresu nie cofa go na listę.
 */
export function useDebouncedFilter(
  apply: (() => void) | null,
  delay: number,
  deps: ReadonlyArray<unknown>,
) {
  const router = useRouter()
  useEffect(() => {
    if (!apply) return
    const path = router.latestLocation.pathname
    const timer = setTimeout(() => {
      if (router.latestLocation.pathname === path) apply()
    }, delay)
    return () => clearTimeout(timer)
    // apply zmienia się z każdym renderem; reagujemy tylko na deps.
  }, deps)
}
