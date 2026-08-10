import { redirect } from 'next/navigation'

import { getAuthUser } from '@/lib/auth'

import { signInWithEmail, signInWithGoogle } from './actions'

const MESSAGES: Record<string, string> = {
  invalid_email: 'That does not look like a valid email address.',
  sign_in_failed: 'Something went wrong signing you in. Please try again.',
  missing_code: 'That sign-in link has expired. Request a new one.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  if (await getAuthUser()) redirect('/')

  const { error, sent } = await searchParams
  const message = error ? (MESSAGES[error] ?? MESSAGES.sign_in_failed) : null

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Diarylah</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            A trading journal that tells you the truth.
          </p>
        </header>

        {message && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {message}
          </p>
        )}

        {sent ? (
          <p className="rounded-md border border-black/10 bg-black/[.03] px-3 py-4 text-sm dark:border-white/15 dark:bg-white/[.04]">
            Check your inbox — if that address has an account, a sign-in link is
            on its way.
          </p>
        ) : (
          <form action={signInWithEmail} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
            <button
              type="submit"
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Send me a sign-in link
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-black/40 dark:text-white/40">
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
          or
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        </div>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  )
}
