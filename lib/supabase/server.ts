import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { supabasePublishableKey, supabaseUrl } from '@/lib/env'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Only Auth and Storage are reachable — the project's Data API is disabled by
 * design, so there is no table access behind this client. Trades go through
 * Prisma. See docs/PLAN.md §3.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies. This is expected and safe:
          // proxy.ts refreshes the session on every request, so a refresh that
          // lands here has already been persisted there.
        }
      },
    },
  })
}
