import { useSyncExternalStore } from 'react'

/**
 * Motyw panelu: jasny, ciemny albo zgodny z systemem. Wybór żyje w localStorage
 * (to wygoda jednej przeglądarki, nie ustawienie konta). Ciemny motyw dotyczy
 * tylko panelu /app: strona marketingowa jest projektowana na jasnym papierze.
 */
export type Theme = 'system' | 'light' | 'dark'
export const themes: readonly Theme[] = ['system', 'light', 'dark']

const KEY = 'ph-theme'
const listeners = new Set<() => void>()
// Zapas, gdy przeglądarka nie daje localStorage (tryb prywatny).
let memory: Theme | null = null

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return memory ?? 'system'
  }
}

function systemDark() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolvedDark(theme: Theme = readTheme()) {
  return theme === 'dark' || (theme === 'system' && systemDark())
}

/** Nakłada klasę .dark na <html>; `on = false` zdejmuje ją (wyjście z panelu). */
export function applyTheme(on = true) {
  const root = document.documentElement
  const dark = on && resolvedDark()
  root.classList.toggle('dark', dark)
  root.style.colorScheme = on ? (dark ? 'dark' : 'light') : ''
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Prywatny tryb bez localStorage: motyw działa do odświeżenia strony.
    memory = theme
  }
  applyTheme()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => {
    if (readTheme() === 'system') applyTheme()
    listener()
  }
  media.addEventListener('change', onSystem)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onSystem)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'system')
}

/**
 * Skrypt w <head>: ustawia motyw przed pierwszym malowaniem panelu, żeby ciemny
 * motyw nie mignął jasnym ekranem ładowania.
 */
export const themeBootScript = `(function(){try{if(location.pathname.indexOf('/app')!==0)return;var t=localStorage.getItem('${KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}}catch(e){}})()`
