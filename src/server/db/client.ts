import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { serverEnv } from '../env'
import * as schema from './schema'

/**
 * Połączenie z Postgresem (lokalnie albo na Railway). Aplikacja działa cały czas,
 * więc wystarcza zwykła pula połączeń `pg`.
 */
const pool = new pg.Pool({
  connectionString: serverEnv.databaseUrl,
  max: serverEnv.databasePoolSize,
  // Zapas na wolne pierwsze połączenie (np. baza po restarcie albo uśpiona u dostawcy).
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
})

export const database = drizzle(pool, { schema, casing: 'snake_case' })
export type Db = typeof database
/** Transakcja albo zwykłe połączenie: funkcje domenowe przyjmują jedno i drugie. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db

let ready: Promise<void> | null = null

/** Wgrywa migracje pod blokadą doradczą (jedna maszyna naraz). */
async function migrateLocked() {
  const client = new pg.Client({
    connectionString: serverEnv.migrationUrl,
    connectionTimeoutMillis: 15_000,
  })
  await client.connect()
  try {
    await client.query("select pg_advisory_lock(hashtext('splits:migrations'))")
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(serverEnv.migrationsDir),
    })
  } finally {
    await client
      .query("select pg_advisory_unlock(hashtext('splits:migrations'))")
      .catch(() => undefined)
    await client.end()
  }
}

/**
 * Migracje przy starcie (raz na proces). Blokada doradcza w Postgresie sprawia, że przy kilku
 * maszynach migracje wykonuje tylko jedna. Wyłączysz to zmienną MIGRATE_ON_START=false.
 */
export function ensureMigrated(): Promise<void> {
  if (!serverEnv.migrateOnStart) return Promise.resolve()
  ready ??= migrateLocked().catch((error: unknown) => {
    // Nieudana próba nie zostaje w pamięci: następne wywołanie spróbuje jeszcze raz.
    ready = null
    throw error
  })
  return ready
}

export async function closeDb() {
  await pool.end()
}
