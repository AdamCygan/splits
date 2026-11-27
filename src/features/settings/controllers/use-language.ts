import { useQuery } from '@tanstack/react-query'
import type { Locale } from '#/i18n/config'
import { useI18n } from '#/i18n/context'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { settingsApi } from '../data/api'
import { settingsQuery } from '../data/queries'

/** Język aplikacji: zmiana od razu w interfejsie i zapis w ustawieniach konta (e-maile). */
export function useLanguage() {
  const { locale, setLocale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const save = useDataMutation(
    (next: Locale) => settingsApi.update({ ...settings!, locale: next }),
    { invalidate: [keys.settings] },
  )
  const change = (next: Locale) => {
    if (settings) save.mutate(next)
    void setLocale(next)
  }
  return { locale, change }
}
