import { NextResponse, type NextRequest } from 'next/server'

import { ensureUserProfile } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Where Supabase sends the user back after a magic link or an OAuth provider.
 * Exchanges the one-time code for a session, then makes sure the profile row
 * mirroring auth.users exists.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Open-redirect guard: `next` arrives in a URL the user may have been sent,
  // so only same-site relative paths are honoured. "//evil.example" is a
  // protocol-relative absolute URL, which is why the second check is needed.
  const requested = searchParams.get('next') ?? '/'
  const next =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'

  // Behind Vercel's proxy the request origin is internal; the forwarded host is
  // the one the user actually typed.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    // Deliberately vague: the caller learns the sign-in failed, not why.
    return NextResponse.redirect(`${baseUrl}/login?error=sign_in_failed`)
  }

  await ensureUserProfile(data.user)

  return NextResponse.redirect(`${baseUrl}${next}`)
}
