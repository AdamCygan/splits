import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { accountApi } from '../data/api'
import type { IdentityInput } from '../data/dto'
import { sessionsQuery } from '../data/queries'

export interface TwoFactorActionsOptions {
  /** Po wyłączeniu 2FA albo wygenerowaniu kodów (czyszczenie formularza). */
  onDone: () => void
  /** Nowe kody zapasowe do pokazania raz. */
  onNewCodes: (codes: Array<string>) => void
}

/** Wyłączenie 2FA i nowe kody zapasowe: oba wymagają hasła albo kodu z aplikacji. */
export function useTwoFactorActions({
  onDone,
  onNewCodes,
}: TwoFactorActionsOptions) {
  const messages = useMessages(settingsMessages).security
  const disable = useDataMutation(
    (identity: IdentityInput) => accountApi.twoFactorDisable(identity),
    {
      invalidate: [keys.security],
      success: messages.disabled,
      onSuccess: onDone,
    },
  )
  const regenerate = useDataMutation(
    (identity: IdentityInput) => accountApi.newRecoveryCodes(identity),
    {
      invalidate: [keys.security],
      onSuccess: (result) => {
        onDone()
        onNewCodes(result.recoveryCodes)
      },
    },
  )
  return { disable, regenerate }
}

export interface TwoFactorSetupOptions {
  hasPassword: boolean
  onEnabled: (codes: Array<string>) => void
}

export interface TwoFactorEnableInput {
  code: string
  password: string
}

/**
 * Włączanie 2FA: nowy sekret przy każdym otwarciu (zapisuje się dopiero po poprawnym kodzie),
 * kod QR jako obrazek data: URL, potem potwierdzenie kodem z aplikacji (+ hasło).
 */
export function useTwoFactorSetup({
  hasPassword,
  onEnabled,
}: TwoFactorSetupOptions) {
  const messages = useMessages(settingsMessages).security
  const [secret, setSecret] = useState<{
    secret: string
    otpauthUrl: string
  } | null>(null)
  const [qrCode, setQr] = useState('')
  const start = useDataMutation(() => accountApi.twoFactorSetup(), {
    invalidate: [],
    onSuccess: setSecret,
  })
  const enable = useDataMutation(
    ({ code, password }: TwoFactorEnableInput) =>
      accountApi.twoFactorEnable({
        secret: secret!.secret,
        code,
        password: hasPassword ? password : undefined,
      }),
    {
      invalidate: [keys.security, keys.sessions],
      success: messages.enabled,
      onSuccess: (result) => onEnabled(result.recoveryCodes),
    },
  )
  useEffect(() => {
    start.mutate(undefined)
  }, [])
  useEffect(() => {
    if (!secret) return
    // Obrazek (data: URL) zamiast wstawiania SVG jako HTML: nic z niego nie może się wykonać.
    void import('qrcode').then((QR) =>
      QR.toDataURL(secret.otpauthUrl, { margin: 1, width: 400 }).then(setQr),
    )
  }, [secret])
  return { secret, qrCode, enable }
}

/** Zalogowane urządzenia: lista sesji, wylogowanie jednej albo wszystkich poza bieżącą. */
export function useDevices() {
  const messages = useMessages(settingsMessages).security
  const sessions = useQuery(sessionsQuery).data ?? []
  const revoke = useDataMutation((id: string) => accountApi.revokeSession(id), {
    invalidate: [keys.sessions],
    success: messages.signedOut,
  })
  const others = useDataMutation(() => accountApi.revokeOtherSessions(), {
    invalidate: [keys.sessions],
    success: messages.othersSignedOut,
  })
  return { sessions, revoke, others }
}
