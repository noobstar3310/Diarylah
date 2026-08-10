import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { supabasePublishableKey, supabaseUrl } from '@/lib/env'

/**
 * Refreshes the Supabase session on every request.
 *
 * Next 16 renamed Middleware to Proxy — this file is `proxy.ts`, not
 * `middleware.ts`, and exports `proxy`. Supabase's own documentation still says
 * middleware; it is describing an older Next.
 *
 * Auth tokens expire. Server Components cannot write cookies, so without this
 * a user would be silently signed out mid-session the moment their token
 * lapsed. This runs before the request completes, refreshes the token, and
 * writes the new cookies onto the response.
 *
 * This is *not* the authorization boundary. Per the Next.js guidance, Proxy is
 * for optimistic checks only — the real check is `requireUser()` in lib/auth.ts,
 * which runs in the Server Component or Server Action that actually reads data.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser(), not getSession(): this revalidates the token with Supabase
  // rather than trusting the cookie, and it is what triggers the refresh.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth cookies are not
     * needed to serve a favicon, and running this on every asset would add a
     * round trip to Supabase for no benefit.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
