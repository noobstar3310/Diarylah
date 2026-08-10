/**
 * Validated environment access.
 *
 * Accessors are lazy rather than module-level constants: `next build` evaluates
 * modules during prerendering, and CI builds legitimately run without real
 * Supabase credentials. Failing at first use gives a clear error at the right
 * moment instead of breaking the build.
 *
 * The `process.env.NEXT_PUBLIC_*` references must stay as literals — Next
 * inlines them at build time by textual substitution, so a computed lookup
 * would silently resolve to undefined in the browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`)
  }
  return value
}

/** Safe in the browser: with the Data API disabled it reaches only Auth and Storage. */
export const supabaseUrl = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)

export const supabasePublishableKey = () =>
  required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
