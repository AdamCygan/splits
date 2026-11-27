import { randomInt } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Locale } from '#/i18n/config'
import { site } from '#/config/site'
import { verifyPassword } from '../auth/passwords'
import { randomToken, sha256 } from '../auth/tokens'
import { decryptSecret, hashRecoveryCode, verifyTotp } from '../auth/totp'
import type { Tx } from '../db/client'
import { db } from '../db/client'
import { authTokens, userSettings, users } from '../db/schema'
import { accountEmail, sendEmail } from '../email'
import { serverEnv } from '../env'
import { ApiError } from '../http/errors'

type UserRow = typeof users.$inferSelect

export const EMAIL_TOKEN_HOURS = 24

/** Język e-maili: z ustawień konta (domyślnie angielski). */
export async function localeOf(userId: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: userSettings.locale })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
  return row?.locale === 'pl' ? 'pl' : 'en'
}

const link = (path: string) => `${serverEnv.appUrl}${path}`

/** E-mail o koncie z imieniem, linkiem do ustawień bezpieczeństwa i adresem wsparcia. */
export async function notify(
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'isDemo'>,
  kind: Parameters<typeof accountEmail>[0],
  vars: Record<string, string> = {},
  to = user.email,
) {
  if (user.isDemo) return
  await sendEmail(
    accountEmail(kind, await localeOf(user.id), to, {
      name: user.displayName,
      link: link('/forgot-password'),
      support: site.supportEmail,
      ...vars,
    }),
  )
}

/** Link potwierdzający adres (rejestracja) albo nowy adres (zmiana e-maila), ważny 24 h. */
export async function sendEmailConfirmation(
  tx: Tx,
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'isDemo'>,
  newEmail: string | null,
) {
  // Poprzednie niewykorzystane linki tego rodzaju przestają działać.
  const purpose = newEmail ? 'email_change' : 'email_verification'
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, user.id),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
      ),
    )
  const token = randomToken()
  await tx.insert(authTokens).values({
    userId: user.id,
    purpose,
    tokenHash: sha256(token),
    newEmail,
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_HOURS * 3_600_000),
  })
  const url = link(`/confirm-email?token=${token}`)
  if (newEmail) {
    await notify(user, 'emailChange', { link: url }, newEmail)
    await notify(user, 'emailChangeNotice', {
      email: newEmail,
      link: link('/app/settings/account'),
    })
  } else await notify(user, 'verify', { link: url })
}

/**
 * Kod drugiego kroku: 6 cyfr z aplikacji albo kod zapasowy (jednorazowy).
 * Zapisuje zużyty krok TOTP albo usuwa kod zapasowy; zwraca false przy złym kodzie.
 */
export async function useSecondFactor(
  tx: Tx,
  user: UserRow,
  code: string,
): Promise<boolean> {
  if (!user.totpSecret) return false
  const step = verifyTotp(
    decryptSecret(user.totpSecret),
    code,
    user.totpLastStep,
  )
  if (step !== null) {
    await tx
      .update(users)
      .set({ totpLastStep: step })
      .where(eq(users.id, user.id))
    return true
  }
  const hash = hashRecoveryCode(code)
  if (
    code.replace(/[^a-f0-9]/gi, '').length === 10 &&
    user.recoveryCodes.includes(hash)
  ) {
    await tx
      .update(users)
      .set({ recoveryCodes: user.recoveryCodes.filter((h) => h !== hash) })
      .where(eq(users.id, user.id))
    return true
  }
  return false
}

export interface IdentityProof {
  password?: string | null
  code?: string | null
}

/**
 * Potwierdzenie tożsamości przed zmianą wrażliwych ustawień: hasło (jeśli konto je ma)
 * i kod 2FA (jeśli włączone). Konto tylko z Google bez 2FA przechodzi samą sesją.
 */
export async function confirmIdentity(
  tx: Tx,
  user: UserRow,
  input: IdentityProof,
) {
  if (
    user.passwordHash &&
    !(await verifyPassword(input.password ?? '', user.passwordHash))
  )
    throw new ApiError('auth.wrong_password', 400, 'password')
  if (
    user.totpEnabledAt &&
    !(await useSecondFactor(tx, user, input.code ?? ''))
  )
    throw new ApiError('auth.invalid_code', 400, 'code')
}

export const DELETE_CODE_MINUTES = 15

/** Kod usunięcia konta nie musi być unikalny między kontami: haszujemy go z id konta. */
const deletionHash = (userId: string, code: string) =>
  sha256(`account_deletion:${userId}:${code}`)

/**
 * Kod do usunięcia konta (6 cyfr, ważny 15 minut) na adres konta. Wcześniejsze kody
 * przestają działać. Potwierdza, że usuwa właściciel skrzynki, także konta bez hasła.
 */
export async function sendDeletionCode(
  tx: Tx,
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'isDemo'>,
) {
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, user.id),
        eq(authTokens.purpose, 'account_deletion'),
        isNull(authTokens.usedAt),
      ),
    )
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await tx.insert(authTokens).values({
    userId: user.id,
    purpose: 'account_deletion',
    tokenHash: deletionHash(user.id, code),
    expiresAt: new Date(Date.now() + DELETE_CODE_MINUTES * 60_000),
  })
  await notify(user, 'deleteCode', {
    code,
    minutes: String(DELETE_CODE_MINUTES),
  })
}

/** Zużywa kod usunięcia konta; zły, zużyty albo przeterminowany kod = błąd pola `code`. */
export async function consumeDeletionCode(
  tx: Tx,
  userId: string,
  code: string,
) {
  const [row] = await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.purpose, 'account_deletion'),
        eq(authTokens.tokenHash, deletionHash(userId, code.trim())),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ id: authTokens.id })
  if (!row) throw new ApiError('auth.invalid_delete_code', 400, 'code')
}
