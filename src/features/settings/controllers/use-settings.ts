import { settingsQuery } from '../data/queries'
import { useQuery } from '@tanstack/react-query'

/** Hook pomocniczy do innych sekcji: bieżące ustawienia (np. dni robocze dla sprintów). */
export function useSettings() {
  return useQuery(settingsQuery).data
}
