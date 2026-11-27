import { Segmented } from '#/components/ui/segmented'
import { useLanguage } from '#/features/settings/controllers/use-language'
import { SettingsCard } from '#/features/settings/views/ui'
import { locales, localeNames } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'

/** Język aplikacji i e-maili o koncie (zapis w ustawieniach konta). */
export function LanguageCard() {
  const t = useMessages(settingsMessages).account
  const { locale, change } = useLanguage()
  return (
    <SettingsCard title={t.languageTitle} lead={t.languageLead}>
      <Segmented<Locale>
        label={t.languageTitle}
        hideLabel
        value={locale}
        options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        onChange={change}
      />
    </SettingsCard>
  )
}
