import { useSyncExternalStore } from 'react'
import { createLocalStore } from './local-store'

/**
 * Motyw panelu: jasny, ciemny albo zgodny z systemem. Wybór żyje w localStorage
 * (to wygoda jednej przeglądarki, nie ustawienie konta). Ciemny motyw dotyczy
 * tylko panelu /app: strona marketingowa jest projektowana na jasnym papierze.
 */
export type Theme = 'system' | 'light' | 'dark'
export const themes: readonly Theme[] = ['system', 'light', 'dark']

const store = createLocalStore<Theme>('ph-theme', themes, 'system')
export const readTheme = store.read

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
  store.set(theme)
  applyTheme()
}

/** Motyw z localStorage; zmiana motywu systemu przerysowuje i przemalowuje „Jak w systemie”. */
function subscribe(listener: () => void) {
  const off = store.subscribe(listener)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => {
    const followsSystem = readTheme() === 'system'
    if (followsSystem) applyTheme()
    listener()
  }
  media.addEventListener('change', onSystem)
  return () => {
    off()
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
export const themeBootScript = `try{if(location.pathname.indexOf('/app')===0){const t=localStorage.getItem('${store.key}');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}}}catch{}`
