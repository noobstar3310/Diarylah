'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createSupabaseServerClient } from '@/lib/supabase/server'

const EmailSchema = z.email().max(320)

/** The origin the user actually reached us on, honouring Vercel's proxy headers. */
async function siteOrigin() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const proto =
    headerList.get('x-forwarded-proto') ??
    (host?.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function signInWithEmail(formData: FormData) {
  const parsed = EmailSchema.safeParse(formData.get('email'))

  if (!parsed.success) {
    redirect('/login?error=invalid_email')
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    // /auth/confirm, not /auth/callback: email links use verifyOtp with a token
    // hash so they survive being opened on a different device. See that route.
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  })

  if (error) {
    // Detail server-side, generic message to the caller — CLAUDE.md §5.3.
    // Never log the address itself; it is the user's identity, not a debug value.
    console.error('[auth] signInWithOtp failed', {
      status: error.status,
      code: error.code,
      message: error.message,
    })
    redirect('/login?error=sign_in_failed')
  }

  // Deliberately identical whether or not the address has an account: telling
  // the caller which emails are registered would leak the user list.
  redirect('/login?sent=1')
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  })

  if (error || !data.url) {
    console.error('[auth] signInWithOAuth failed', {
      status: error?.status,
      code: error?.code,
      message: error?.message ?? 'no redirect url returned',
    })
    redirect('/login?error=sign_in_failed')
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
