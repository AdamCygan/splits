import { useQuery } from '@tanstack/react-query'
import { Segmented } from '#/components/ui/segmented'
import { data } from '#/data'
import { locales, localeNames } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { useI18n, useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys, settingsQuery, useDataMutation } from '../../queries'
import { SettingsCard } from '../ui'

/** Język aplikacji i e-maili o koncie (zapis w ustawieniach konta). */
export function LanguageCard() {
  const t = useMessages(settingsMessages).account
  const { locale, setLocale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const save = useDataMutation(
    (next: Locale) => data.settings.update({ ...settings!, locale: next }),
    { invalidate: [keys.settings] },
  )
  return (
    <SettingsCard title={t.languageTitle} lead={t.languageLead}>
      <Segmented<Locale>
        label={t.languageTitle}
        hideLabel
        value={locale}
        options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        onChange={(next) => {
          if (settings) save.mutate(next)
          void setLocale(next)
        }}
      />
    </SettingsCard>
  )
}
