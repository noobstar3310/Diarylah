/**
 * Pure tenancy-scoping logic for the Prisma client extension in lib/db.ts.
 *
 * Deliberately framework-free and side-effect-free: it takes an operation and
 * returns the rewritten arguments, or throws. That makes it exhaustively
 * unit-testable without a database, which matters — this is the single control
 * standing between one trader's book and another's. See docs/PLAN.md §3.2.
 */

/** Models carrying a direct owner column. */
export const DIRECTLY_OWNED = {
  User: 'id',
  Journal: 'userId',
  Trade: 'userId',
  Rule: 'userId',
  DailyReview: 'userId',
  PushSubscription: 'userId',
  ReminderSchedule: 'userId',
} as const

/**
 * Models owned through a parent. Reads and writes filter on the parent's owner;
 * direct creates are refused, because ownership of the parent cannot be proven
 * here without an extra round trip.
 */
export const OWNED_VIA = {
  TradeImage: 'trade',
  TradeRuleCheck: 'trade',
  InstrumentOverride: 'journal',
} as const

/** Shared reference data: readable by any signed-in user, written by prismaSystem. */
export const GLOBAL_MODELS = new Set(['Instrument', 'FxRate'])

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

/** Operations whose args carry a `where` we can constrain. */
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

const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn'])

/** Operations that carry a mutable `data` payload for existing rows. */
const UPDATE_OPERATIONS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
])

export type ScopeInput<TArgs> = {
  model: string
  operation: string
  args: TArgs
  userId: string
}

type Args = Record<string, unknown>

const isRecord = (v: unknown): v is Args =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Rewrite one Prisma operation so it can only touch rows owned by `userId`.
 *
 * Throws rather than silently permitting anything it cannot prove safe.
 */
export function scopeQuery<TArgs>({
  model,
  operation,
  args,
  userId,
}: ScopeInput<TArgs>): TArgs {
  if (!userId) {
    throw new Error('scopeQuery called without a userId')
  }

  if (GLOBAL_MODELS.has(model)) {
    if (WRITE_OPERATIONS.has(operation)) {
      throw new Error(
        `${model}.${operation}: shared reference data cannot be written through a user-scoped client. Use prismaSystem.`
      )
    }
    return args
  }

  const ownerField = DIRECTLY_OWNED[model as keyof typeof DIRECTLY_OWNED]
  const parentRelation = OWNED_VIA[model as keyof typeof OWNED_VIA]

  if (!ownerField && !parentRelation) {
    // A model reached this code without anyone deciding who owns it. Fail loudly
    // rather than quietly exposing it to every user.
    throw new Error(
      `${model} has no tenancy rule. Add it to DIRECTLY_OWNED, OWNED_VIA, or GLOBAL_MODELS in lib/tenancy.ts.`
    )
  }

  const next: Args = isRecord(args) ? { ...args } : {}
  const predicate: Args = ownerField
    ? { [ownerField]: userId }
    : { [parentRelation]: { userId } }

  if (FILTERABLE_OPERATIONS.has(operation)) {
    // AND-wrap rather than merge, so a caller-supplied `where` cannot override
    // the tenant predicate no matter how it is shaped.
    next.where = { AND: [next.where ?? {}, predicate] }
  }

  if (CREATE_OPERATIONS.has(operation) || operation === 'upsert') {
    if (parentRelation) {
      throw new Error(
        `${model}.${operation}: create these through their parent so ownership is provable, e.g. trade.update({ data: { images: { create: … } } }).`
      )
    }

    const key = operation === 'upsert' ? 'create' : 'data'
    const payload = next[key]

    // The injected owner is applied last, so a forged value in the payload is
    // overwritten rather than honoured.
    next[key] = Array.isArray(payload)
      ? payload.map((row) => ({ ...(isRecord(row) ? row : {}), [ownerField]: userId }))
      : { ...(isRecord(payload) ? payload : {}), [ownerField]: userId }
  }

  if (UPDATE_OPERATIONS.has(operation) && ownerField) {
    // Reassigning ownership is never legitimate through a scoped client: the
    // caller owns the row now, and this would hand it to someone else. Without
    // this check, `update({ where: { id }, data: { userId: other } })` passes
    // the scope filter and then gives the row away.
    const data = operation === 'upsert' ? next.update : next.data
    if (isRecord(data) && ownerField in data) {
      throw new Error(
        `${model}.${operation}: cannot reassign ${ownerField} through a user-scoped client.`
      )
    }
  }

  // The rewritten object is structurally the caller's args plus a narrowed
  // `where` and a stamped owner column, which Prisma's per-operation arg types
  // cannot express generically. The shape is covered by lib/tenancy.test.ts.
  return next as TArgs
}
