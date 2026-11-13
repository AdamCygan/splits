import { defineConfig } from 'drizzle-kit'

/** `pnpm db:generate` tworzy migrację SQL ze zmian w schemacie, `pnpm db:migrate` ją wgrywa. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      'postgresql://postgres@localhost:5432/splits',
  },
  strict: true,
  verbose: true,
})
