import pg from 'pg'

/** Czysta baza testowa przed każdym uruchomieniem: schemat od zera, migracje wgra pierwsze żądanie. */
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres@localhost:5432/splits_test'
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
  )
  await client.end()
}
