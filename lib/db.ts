import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/lib/generated/prisma/client'

/**
 * Tenancy guardrail. See docs/PLAN.md §3.2.
 *
 * Prisma connects directly to Postgres and bypasses Row Level Security, so RLS
 * cannot be the thing that keeps one trader's book out of another's. This module
 * is that thing.
 *
 * The unscoped client below is module-private. The only ordinary way to reach
 * the database is `prismaForUser(userId)`, which rewrites every query to filter
 * on the authenticated user. A query that forgets tenancy is not discouraged —
 * it is unreachable.
 *
 * `prismaSystem` is the deliberate, narrow exception. See its doc comment.
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

// ---------------------------------------------------------------------------
// Which models are owned by whom
// ---------------------------------------------------------------------------

/** Models carrying a direct owner column. */
const DIRECTLY_OWNED = {
  User: 'id',
  Journal: 'userId',
  Trade: 'userId',
  Rule: 'userId',
  DailyReview: 'userId',
  PushSubscription: 'userId',
  ReminderSchedule: 'userId',
} as const

/**
 * Models owned through a parent. Reads and writes are filtered by the parent's
 * owner; direct creates are refused (see below) because ownership cannot be
 * verified without an extra round trip.
 */
const OWNED_VIA = {
  TradeImage: 'trade',
  TradeRuleCheck: 'trade',
  InstrumentOverride: 'journal',
} as const

/** Shared reference data. Readable by everyone, written only by prismaSystem. */
const GLOBAL_MODELS = new Set(['Instrument', 'FxRate'])

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/** Operations whose `args` carry a `where` we can constrain. */
const FILTERABLE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
])

type QueryArgs = {
  where?: Record<string, unknown>
  data?: Record<string, unknown> | Record<string, unknown>[]
  create?: Record<string, unknown>
}

/** Merge a tenant predicate into `where` without letting a caller override it. */
const constrain = (where: unknown, predicate: Record<string, unknown>) => ({
  AND: [where ?? {}, predicate],
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A Prisma client locked to one user.
 *
 * Every read, update and delete is filtered to rows they own, and creates have
 * the owner column stamped on automatically — a caller cannot set it to someone
 * else's id, because the injected value wins.
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
          if (GLOBAL_MODELS.has(model)) {
            // Shared reference data. Reads are fine; writes belong to prismaSystem.
            if (WRITE_OPERATIONS.has(operation)) {
              throw new Error(
                `${model}.${operation} is shared reference data and cannot be written through prismaForUser. Use prismaSystem.`
              )
            }
            return query(args)
          }

          const ownerField =
            DIRECTLY_OWNED[model as keyof typeof DIRECTLY_OWNED]
          const parentRelation = OWNED_VIA[model as keyof typeof OWNED_VIA]

          if (!ownerField && !parentRelation) {
            // A model was added to the schema without deciding how it is owned.
            // Fail loudly rather than silently exposing it to every user.
            throw new Error(
              `${model} has no tenancy rule in lib/db.ts. Add it to DIRECTLY_OWNED, OWNED_VIA, or GLOBAL_MODELS.`
            )
          }

          const next = { ...((args ?? {}) as QueryArgs) }
          const predicate = ownerField
            ? { [ownerField]: userId }
            : { [parentRelation]: { userId } }

          if (FILTERABLE_OPERATIONS.has(operation)) {
            next.where = constrain(next.where, predicate)
          }

          if (operation === 'create' || operation === 'upsert') {
            if (parentRelation) {
              // Ownership of the parent cannot be proven here. Create these
              // through a nested write on an already-scoped parent instead, e.g.
              // trade.update({ where: { id }, data: { images: { create: … } } }).
              throw new Error(
                `${model}.${operation} must be created through its parent so ownership is provable. See lib/db.ts.`
              )
            }
            const key = operation === 'create' ? 'data' : 'create'
            next[key] = { ...(next[key] as object), [ownerField]: userId }
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            if (parentRelation) {
              throw new Error(
                `${model}.${operation} must be created through its parent so ownership is provable. See lib/db.ts.`
              )
            }
            const rows = next.data
            next.data = Array.isArray(rows)
              ? rows.map((row) => ({ ...row, [ownerField]: userId }))
              : { ...(rows as object), [ownerField]: userId }
          }

          return query(next)
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
