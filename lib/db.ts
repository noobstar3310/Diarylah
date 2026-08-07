import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/lib/generated/prisma/client'
import { scopeQuery } from '@/lib/tenancy'

/**
 * Tenancy guardrail. See docs/PLAN.md §3.2.
 *
 * Prisma connects directly to Postgres and bypasses Row Level Security, so RLS
 * cannot be the thing that keeps one trader's book out of another's. This module
 * is that thing.
 *
 * The unscoped client below is module-private. The only ordinary way to reach
 * the database is `prismaForUser(userId)`. A query that forgets tenancy is not
 * discouraged — it is unreachable.
 *
 * The rewriting rules live in lib/tenancy.ts as pure functions so they can be
 * exhaustively tested without a database. This file is only the wiring.
 */

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.'
  )
}

// Pooled connection (port 6543). Migrations use DIRECT_URL via prisma.config.ts.
const adapter = new PrismaPg({ connectionString })

const createClient = () => new PrismaClient({ adapter })

// Next.js hot-reloads modules in development, which would otherwise open a new
// connection pool on every edit until Postgres refuses them.
const globalForPrisma = globalThis as unknown as {
  __diarylahPrisma?: ReturnType<typeof createClient>
}

const base = globalForPrisma.__diarylahPrisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__diarylahPrisma = base
}

/**
 * A Prisma client locked to one user.
 *
 * Every read, update and delete is filtered to rows they own; creates have the
 * owner stamped on automatically; ownership cannot be reassigned; and any model
 * without a declared tenancy rule throws rather than leaking.
 *
 * Always derive `userId` from the verified session. Never from client input.
 */
export function prismaForUser(userId: string) {
  if (!userId) {
    throw new Error('prismaForUser called without a userId')
  }

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeQuery({ model, operation, args, userId }))
        },
      },
    },
  })
}

export type ScopedPrisma = ReturnType<typeof prismaForUser>

/**
 * The unscoped client. **Bypasses every tenancy check above.**
 *
 * Legitimate uses, and no others:
 *   - seeding and maintaining the shared Instrument catalogue
 *   - writing the FxRate cache from the scheduled job
 *   - creating the User row immediately after Supabase Auth signup, before a
 *     scoped client can exist
 *   - the cron job that fans out push reminders across all users
 *
 * Never import this into a Server Action that handles user input. If you are
 * reaching for it to answer a request on behalf of a signed-in user, you want
 * `prismaForUser` instead.
 */
export const prismaSystem = base
