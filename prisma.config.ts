import { defineConfig, env } from 'prisma/config'

// Prisma 7 does not load .env files automatically, and Next.js keeps secrets in
// .env.local rather than .env. Bridge the two so `prisma migrate` and friends see
// DATABASE_URL / DIRECT_URL. Guarded because hosted environments (Vercel, CI)
// inject env vars directly and have no .env.local on disk.
try {
  process.loadEnvFile('.env.local')
} catch {
  // no local env file — assume the platform provided the variables
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrate runs DDL, which a transaction pooler cannot do — so the CLI uses
    // the session pooler (port 5432). Runtime queries go through the pooled
    // DATABASE_URL via a driver adapter instead.
    url: env('DIRECT_URL'),
  },
})
