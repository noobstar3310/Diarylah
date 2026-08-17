import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { ensureUserProfile } from '@/lib/auth'
import { resolveBaseUrl, safeNextPath } from '@/lib/http'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Where email sign-in links land.
 *
 * Deliberately *not* the PKCE code flow used by /auth/callback. PKCE stores a
 * verifier in the browser that began the flow, so it fails whenever a link is
 * opened somewhere else — requesting a link on a laptop and opening it on a
 * phone is completely ordinary, and would break every time.
 *
 * `verifyOtp` with a token hash carries its own proof, so the link works from
 * any device. The token is single-use and short-lived.
 *
 * Requires the Supabase magic-link email template to point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const baseUrl = resolveBaseUrl(request, origin)

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error || !data.user) {
    // Vague to the caller, detailed in the server log.
    console.error('[auth] verifyOtp failed', {
      status: error?.status,
      code: error?.code,
      message: error?.message ?? 'no user returned',
    })
    return NextResponse.redirect(`${baseUrl}/login?error=sign_in_failed`)
  }

  await ensureUserProfile(data.user)

  return NextResponse.redirect(`${baseUrl}${next}`)
}
