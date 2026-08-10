import { signOut } from '@/app/login/actions'
import { getDb, requireUser } from '@/lib/auth'

/**
 * Phase 0 placeholder. Deliberately minimal — its job is to prove the whole
 * chain works end to end: verified session, profile row, user-scoped Prisma
 * client, real query. Phase 1 replaces it with the journal.
 */
export default async function Home() {
  const user = await requireUser()
  const db = await getDb()

  // Scoped client: journals returns only this user's rows, instruments is
  // shared reference data and passes through unfiltered. See lib/tenancy.ts.
  const [journalCount, instrumentCount] = await Promise.all([
    db.journal.count(),
    db.instrument.count(),
  ])

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Diarylah</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Signed in as {user.email}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 dark:border-white/15 dark:bg-white/15">
        {[
          { label: 'Your journals', value: journalCount },
          { label: 'Instruments available', value: instrumentCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background p-4">
            <dt className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
