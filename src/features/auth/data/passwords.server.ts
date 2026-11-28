import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'

/**
 * Hasła: scrypt z wbudowanego modułu crypto (bez natywnych zależności).
 * Parametry wg OWASP Password Storage Cheat Sheet: N=2^15, r=8, p=3 (ok. 32 MB pamięci na próbę).
 * Format: scrypt$N$r$p$sól$hash (base64url) — parametry można później podnieść bez migracji.
 */
const SCRYPT_COST = 2 ** 15
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 3
const KEY_LENGTH = 32

function scrypt(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      options,
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })
}

const maxmem = (cost: number, blockSize: number) => 256 * cost * blockSize

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: maxmem(SCRYPT_COST, SCRYPT_BLOCK_SIZE),
  })
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, salt, hash] =
    stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: maxmem(Number(cost), Number(blockSize)),
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Hash do porównań, gdy konto nie istnieje: odpowiedź trwa tyle samo (brak wycieku, które loginy istnieją). */
let dummy: Promise<string> | null = null
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword('not-a-real-password-0')
  await verifyPassword(password, await dummy)
}
