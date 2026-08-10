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
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  })

  if (error) {
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
    redirect('/login?error=sign_in_failed')
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
