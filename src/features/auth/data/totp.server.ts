import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { serverEnv } from '#/server/env'

/**
 * Dwuetapowe logowanie (2FA) kodami TOTP z aplikacji (RFC 6238: SHA-1, 6 cyfr, 30 s),
 * bez zewnętrznych bibliotek. Sekret leży w bazie zaszyfrowany AES-256-GCM.
 */
const STEP_SECONDS = 30
const DIGITS = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: Array<number> = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) throw new Error('invalid base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** Nowy sekret: 20 losowych bajtów (160 bitów, jak zaleca RFC 4226). */
export const newTotpSecret = () => base32Encode(randomBytes(20))

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1]! & 15
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS
  return String(code).padStart(DIGITS, '0')
}

export const currentStep = (now = Date.now()) =>
  Math.floor(now / 1000 / STEP_SECONDS)

/**
 * Sprawdza kod z tolerancją ±1 krok (zegar telefonu się spieszy albo spóźnia).
 * Zwraca krok, na którym kod pasuje, albo null. `lastStep` blokuje ponowne użycie kodu.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastStep: number | null,
  now = Date.now(),
): number | null {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const step = currentStep(now)
  for (const candidate of [step - 1, step, step + 1]) {
    if (lastStep !== null && candidate <= lastStep) continue
    const expected = Buffer.from(totpAt(secret, candidate))
    if (timingSafeEqual(expected, Buffer.from(clean))) return candidate
  }
  return null
}

export function otpauthUrl(secret: string, account: string) {
  const label = encodeURIComponent(`Timeblame:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=Timeblame&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
}

/** GCM z pełnym, 16-bajtowym tagiem: krótszy tag z bazy nie przejdzie deszyfrowania. */
const GCM_TAG_LENGTH = 16

const key = () =>
  createHash('sha256').update(`totp:${serverEnv.jwtSecret}`).digest()

export function encryptSecret(secret: string): string {
  const initializationVector = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), initializationVector, {
    authTagLength: GCM_TAG_LENGTH,
  })
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [initializationVector, cipher.getAuthTag(), data]
    .map((nonSharedBuffer) => nonSharedBuffer.toString('base64url'))
    .join('.')
}

export function decryptSecret(stored: string): string {
  const [initializationVector, tag, data] = stored
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    initializationVector!,
    {
      authTagLength: GCM_TAG_LENGTH,
    },
  )
  decipher.setAuthTag(tag!)
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString(
    'utf8',
  )
}

/** 10 kodów zapasowych w formacie xxxx-xxxx (do wpisania zamiast kodu z aplikacji). */
export function newRecoveryCodes(): Array<string> {
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(5).toString('hex')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

export const hashRecoveryCode = (code: string) =>
  createHash('sha256')
    .update(
      code
        .trim()
        .toLowerCase()
        .replace(/[^a-f0-9]/g, ''),
    )
    .digest('hex')
