import { Field } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'

export interface IdentityFieldsProps {
  /** Konto ma hasło (konta z samym Google go nie mają). */
  needsPassword: boolean
  /** Włączone logowanie dwuetapowe: potrzebny kod z aplikacji albo zapasowy. */
  needsCode: boolean
  password: string
  code: string
  onPassword: (value: string) => void
  onCode: (value: string) => void
  passwordError?: string | null
  codeError?: string | null
}

/** Hasło i kod 2FA przed zmianą wrażliwych ustawień: tylko te pola, które konto ma. */
export function IdentityFields({
  needsPassword,
  needsCode,
  password,
  code,
  onPassword,
  onCode,
  passwordError,
  codeError,
}: IdentityFieldsProps) {
  const t = useMessages(settingsMessages).security
  return (
    <>
      {needsPassword && (
        <Field label={t.password} error={passwordError}>
          {(a) => (
            <Input
              {...a}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => onPassword(e.target.value)}
            />
          )}
        </Field>
      )}
      {needsCode && (
        <Field label={t.code} hint={t.codeHint} error={codeError}>
          {(a) => (
            <Input
              {...a}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="max-w-48 font-mono tracking-widest"
              value={code}
              onChange={(e) => onCode(e.target.value)}
            />
          )}
        </Field>
      )}
    </>
  )
}
