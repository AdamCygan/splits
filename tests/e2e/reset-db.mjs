// Czysta baza E2E przed startem serwera testowego; serwer wgra migracje przy pierwszym żądaniu.
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(
  'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
)
await client.end()
