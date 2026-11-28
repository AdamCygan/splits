import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import type { Tx } from '#/server/db/client'
import { refreshTokens } from '#/server/db/schema'
import { serverEnv } from '#/server/env'

export const ACCESS_TOKEN_MINUTES = 15
export const REFRESH_TOKEN_DAYS = 30
export const REFRESH_COOKIE = 'refresh_token'
export const REFRESH_COOKIE_PATH = '/api/v1/auth'
/**
 * Okno tolerancji: token wymieniony przed chwilą wciąż działa (dwie karty odświeżające naraz,
 * odpowiedź zgubiona przez przerwane połączenie). Dopiero starszy jest traktowany jak kradzież.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000

const secret = new TextEncoder().encode(serverEnv.jwtSecret)
const ISSUER = 'timeblame'
const AUDIENCE = 'timeblame-web'

export async function signAccessToken(userId: string) {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_MINUTES * 60_000)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret)
  return { token, expiresAt }
}

/** Zwraca id użytkownika z ważnego access tokenu albo null. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

export const randomToken = () => randomBytes(32).toString('base64url')

/** Skąd przyszło logowanie (lista sesji w ustawieniach). */
export interface ClientMeta {
  userAgent: string | null
  ip: string | null
}

export async function issueRefreshToken(
  transaction: Tx,
  userId: string,
  meta: ClientMeta,
  familyId: string = randomUUID(),
) {
  const token = randomToken()
  await transaction.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000),
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip,
  })
  return token
}

export type RotateResult =
  { ok: true; userId: string; token: string } | { ok: false }

/**
 * Rotacja: stary token zostaje unieważniony, a w jego miejsce powstaje nowy z tej samej rodziny.
 * Użycie już unieważnionego tokenu = ktoś go skopiował, więc unieważniamy całą rodzinę.
 */
export async function rotateRefreshToken(
  transaction: Tx,
  token: string,
  meta: ClientMeta,
): Promise<RotateResult> {
  const [row] = await transaction
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(token)))
    .for('update')
  if (!row) return { ok: false }
  if (row.revokedAt) {
    // Tolerancja tylko dla zwykłej rotacji: następca w tej rodzinie wciąż jest aktywny.
    // Po wylogowaniu albo resecie hasła cała rodzina jest unieważniona, więc nic nie przejdzie.
    const [successor] = await transaction
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.familyId, row.familyId),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1)
    const isWithinGrace =
      successor &&
      Date.now() - row.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS
    if (isWithinGrace) {
      const next = await issueRefreshToken(
        transaction,
        row.userId,
        meta,
        row.familyId,
      )
      return { ok: true, userId: row.userId, token: next }
    }
    await revokeFamily(transaction, row.familyId)
    return { ok: false }
  }
  const isExpired = row.expiresAt.getTime() < Date.now()
  if (isExpired) return { ok: false }
  await transaction
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id))
  const next = await issueRefreshToken(
    transaction,
    row.userId,
    meta,
    row.familyId,
  )
  return { ok: true, userId: row.userId, token: next }
}

export async function revokeFamily(transaction: Tx, familyId: string) {
  await transaction
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.familyId, familyId),
        isNull(refreshTokens.revokedAt),
      ),
    )
}

export async function revokeToken(transaction: Tx, token: string) {
  const [row] = await transaction
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(token)))
  if (row) await revokeFamily(transaction, row.familyId)
}

/** Po zmianie hasła: wylogowanie ze wszystkich innych urządzeń (zostaje bieżąca sesja). */
export async function revokeOtherSessions(
  transaction: Tx,
  userId: string,
  currentToken: string | undefined,
) {
  let keepFamily: string | null = null
  if (currentToken) {
    const [row] = await transaction
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(currentToken)))
    keepFamily = row?.familyId ?? null
  }
  await transaction
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        keepFamily ? ne(refreshTokens.familyId, keepFamily) : undefined,
      ),
    )
}

const MFA_AUDIENCE = 'timeblame-mfa'

/**
 * Bilet drugiego kroku logowania (5 min): hasło albo Google już przeszło, brakuje kodu 2FA.
 * Nie daje dostępu do API (inny `aud` niż access token).
 */
export async function signMfaToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(MFA_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret)
}

export async function verifyMfaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: MFA_AUDIENCE,
      algorithms: ['HS256'],
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/** Unieważnia wszystkie sesje użytkownika (wszystkie rodziny refresh tokenów). */
export async function revokeAllSessions(transaction: Tx, userId: string) {
  await transaction
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    )
}
