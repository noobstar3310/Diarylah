import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { prismaForUser, prismaSystem } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * The Data Access Layer. Every request that touches user data starts here.
 *
 * Security note that matters more than it looks: this uses `getUser()`, never
 * `getSession()`. `getSession()` reads the auth cookie and trusts it;
 * `getUser()` revalidates the JWT with Supabase's auth server. On the server,
 * where the cookie is attacker-controllable input, only `getUser()` is a
 * verification. See CLAUDE.md §5.1.
 *
 * Memoised with React `cache()`, so several components in one render pass share
 * a single verification rather than each making a round trip.
 */

/** The verified user, or null when signed out. */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
})

/** The verified user, redirecting to sign-in when there isn't one. */
export const requireUser = cache(async () => {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
})

/**
 * A database client scoped to the signed-in user.
 *
 * This is the ordinary way to reach data from a Server Component or Server
 * Action. It resolves the session first, so there is no path that queries
 * without having authenticated.
 */
export async function getDb() {
  const user = await requireUser()
  return prismaForUser(user.id)
}

/**
 * Create the profile row mirroring auth.users on first sign-in.
 *
 * Uses `prismaSystem` — one of its four sanctioned uses. A scoped client cannot
 * do this, because the row it would scope to does not exist yet.
 *
 * `timezone` defaults to UTC and is corrected during onboarding. Every notion of
 * "day" in the app derives from it, so leaving it wrong would quietly break
 * streaks and daily P&L. See docs/PLAN.md §6.
 */
export async function ensureUserProfile(user: {
  id: string
  email?: string
  user_metadata?: { full_name?: string; name?: string }
}) {
  const email = user.email
  if (!email) {
    throw new Error(`Supabase user ${user.id} has no email address`)
  }

  const displayName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? null

  await prismaSystem.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email, displayName },
    // Only backfill a display name we do not already have — never overwrite one
    // the user has since chosen for themselves.
    update: { email },
  })
}
