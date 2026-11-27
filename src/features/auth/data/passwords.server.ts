import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'

/**
 * Hasła: scrypt z wbudowanego modułu crypto (bez natywnych zależności).
 * Parametry wg OWASP Password Storage Cheat Sheet: N=2^15, r=8, p=3 (ok. 32 MB pamięci na próbę).
 * Format: scrypt$N$r$p$sól$hash (base64url) — parametry można później podnieść bez migracji.
 */
const N = 2 ** 15
const r = 8
const p = 3
const KEY_LENGTH = 32

function scrypt(password: string, salt: Buffer, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, KEY_LENGTH, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    )
  })
}

const maxmem = (n: number, rr: number) => 256 * n * rr

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, { N, r, p, maxmem: maxmem(N, r) })
  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, n, rr, pp, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
    maxmem: maxmem(Number(n), Number(rr)),
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Hash do porównań, gdy konto nie istnieje: odpowiedź trwa tyle samo (brak wycieku, które loginy istnieją). */
let dummy: Promise<string> | null = null
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword('not-a-real-password-0')
  await verifyPassword(password, await dummy)
}
