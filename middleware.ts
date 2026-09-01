import NextAuth from 'next-auth'
import { NextResponse, type NextRequest } from 'next/server'
import { authConfig } from './auth.config'

const { auth } = NextAuth(authConfig)

// Paths that skip auth() entirely — same set that used to be excluded from
// the matcher outright. Kept as an explicit list (rather than folded back
// into the matcher) because every matched path now needs a nonce generated,
// including these public ones; only the *auth check* is skipped for them.
const PUBLIC_PATHS = [
  'login', 'marketing', 'forgot-password', 'reset-password', 'set-password',
  'verify-email', 'accept-invite', 'accept-dpa', 'accept-terms',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === `/${p}` || pathname.startsWith(`/${p}/`))
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets scripts loaded by an already-trusted (nonced)
    // script load further scripts (e.g. Next.js's own chunk loader) without
    // each one needing its own nonce. 'unsafe-eval' is dev-only — React
    // uses eval in development to reconstruct server error stacks in the
    // browser; neither React nor Next.js use eval in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // style-src intentionally untouched — out of scope for this fix (see
    // docs/audit/2026-09-01-csp-nonce.md).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.sentry.io",
    "frame-src 'self' https://docs.google.com https://drive.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export default async function middleware(request: NextRequest, event: unknown) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp   = buildCsp(nonce)
  const pathname = request.nextUrl.pathname

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authResponse = isPublicPath(pathname) ? null : await (auth as any)(request, event)
  const isRedirect = authResponse != null && authResponse.headers.has('location')

  let response: Response
  if (isRedirect) {
    // Nothing renders for this response — the browser just follows the
    // redirect and hits this middleware again fresh for the new URL. No
    // need to propagate the nonce via request headers, only the CSP header
    // itself (for the redirect response's own tiny body, for consistency).
    response = authResponse
  } else {
    // Rebuild as our own NextResponse.next() so the nonce reaches the
    // downstream page render via request headers (readable there through
    // next/headers' headers().get('x-nonce')) — auth()'s own bare
    // NextResponse.next() does not carry this. Any Set-Cookie auth() set
    // (e.g. NextAuth's JWT sliding-expiry refresh) is preserved below.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    response = NextResponse.next({ request: { headers: requestHeaders } })
    if (authResponse) {
      for (const cookie of authResponse.headers.getSetCookie()) {
        response.headers.append('set-cookie', cookie)
      }
    }
  }

  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|llms\\.txt|google[a-z0-9]+\\.html|opengraph-image|twitter-image|fonts|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.gif).*)'],
}
