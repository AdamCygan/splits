import { Segmented } from '#/components/ui/segmented'
import { useLanguage } from '#/features/settings/controllers/use-language'
import { SettingsCard } from '#/features/settings/views/ui'
import { locales, localeNames } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'

/** Język aplikacji i e-maili o koncie (zapis w ustawieniach konta). */
export function LanguageCard() {
  const messages = useMessages(settingsMessages).account
  const { locale, change } = useLanguage()
  return (
    <SettingsCard title={messages.languageTitle} lead={messages.languageLead}>
      <Segmented<Locale>
        label={messages.languageTitle}
        hideLabel
        value={locale}
        options={locales.map((availableLocale) => ({
          value: availableLocale,
          label: localeNames[availableLocale],
        }))}
        onChange={change}
      />
    </SettingsCard>
  )
}
