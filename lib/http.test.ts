import { describe, expect, it } from 'vitest'
import { resolveBaseUrl, safeNextPath } from './http'

describe('safeNextPath', () => {
  it('allows an ordinary same-site path', () => {
    expect(safeNextPath('/journal/abc')).toBe('/journal/abc')
  })

  it('allows a path with a query string', () => {
    expect(safeNextPath('/trades?sort=recent')).toBe('/trades?sort=recent')
  })

  it('falls back when absent', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('honours a custom fallback', () => {
    expect(safeNextPath(null, '/login')).toBe('/login')
  })

  // Each of these would hand a freshly authenticated user to another origin.
  it.each([
    ['absolute http', 'http://evil.example/steal'],
    ['absolute https', 'https://evil.example/steal'],
    ['protocol-relative', '//evil.example'],
    ['protocol-relative with path', '//evil.example/steal'],
    ['backslash variant', '/\\evil.example'],
    ['scheme without slashes', 'javascript:alert(1)'],
    ['data url', 'data:text/html,<script>alert(1)</script>'],
    ['bare host', 'evil.example'],
  ])('rejects %s', (_label, value) => {
    expect(safeNextPath(value)).toBe('/')
  })

  it('rejects control characters used for header smuggling', () => {
    expect(safeNextPath('/ok\nLocation: https://evil.example')).toBe('/')
    expect(safeNextPath('/ok\r\nSet-Cookie: a=b')).toBe('/')
  })
})

describe('resolveBaseUrl', () => {
  const req = (headers: Record<string, string>) =>
    new Request('http://internal.local/auth/callback', { headers })

  it('uses the request origin when there is no proxy', () => {
    expect(resolveBaseUrl(req({}), 'http://localhost:3000')).toBe(
      'http://localhost:3000'
    )
  })

  it('prefers the forwarded host behind a proxy', () => {
    expect(
      resolveBaseUrl(
        req({ 'x-forwarded-host': 'diarylah.app', 'x-forwarded-proto': 'https' }),
        'http://internal.local'
      )
    ).toBe('https://diarylah.app')
  })

  it('defaults the forwarded protocol to https', () => {
    expect(
      resolveBaseUrl(req({ 'x-forwarded-host': 'diarylah.app' }), 'http://internal.local')
    ).toBe('https://diarylah.app')
  })
})
