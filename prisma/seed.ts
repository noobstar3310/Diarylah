/**
 * Seeds the shared instrument catalogue.
 *
 * Idempotent: upserts by symbol, so running it repeatedly is safe and picks up
 * corrections to contract specs. It never touches user data.
 *
 * Uses `prismaSystem` deliberately — the catalogue is shared reference data with
 * no owner, and the user-scoped client refuses to write it. See lib/db.ts.
 *
 * Run with: npm run db:seed
 */
import { INSTRUMENTS } from './instruments'

// Must happen before lib/db.ts is evaluated, since that module reads
// DATABASE_URL at import time and throws if it is missing. Static imports are
// hoisted and run before any statement in this file, so lib/db is imported
// dynamically inside main() rather than at the top. Hosted environments inject
// the variables directly and have no .env.local on disk.
try {
  process.loadEnvFile('.env.local')
} catch {
  // no local env file — assume the platform provided the variables
}

async function main() {
  const { prismaSystem } = await import('../lib/db')

  try {
    console.log(`Seeding ${INSTRUMENTS.length} instruments…`)

    let created = 0
    let updated = 0

    for (const instrument of INSTRUMENTS) {
      const existing = await prismaSystem.instrument.findUnique({
        where: { symbol: instrument.symbol },
        select: { id: true },
      })

      await prismaSystem.instrument.upsert({
        where: { symbol: instrument.symbol },
        create: instrument,
        // Deliberately does not touch isActive: an operator may have retired an
        // instrument by hand, and a re-seed should not silently resurrect it.
        update: {
          displayName: instrument.displayName,
          kind: instrument.kind,
          contractSize: instrument.contractSize,
          pipSize: instrument.pipSize,
          quoteCurrency: instrument.quoteCurrency,
          sizingMode: instrument.sizingMode,
        },
      })

      if (existing) updated++
      else created++
    }

    const byKind = await prismaSystem.instrument.groupBy({
      by: ['kind'],
      _count: { _all: true },
      orderBy: { kind: 'asc' },
    })

    console.log(`\n  created ${created}, updated ${updated}\n`)
    for (const row of byKind) {
      console.log(`  ${row.kind.padEnd(7)} ${row._count._all}`)
    }
    console.log()
  } finally {
    await prismaSystem.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
