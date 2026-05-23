import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Typed session user — matches the JWT shape set in lib/auth.ts + auth.config.ts.
 * Avoids `session.user as any` casts throughout server pages and actions.
 */
export interface AuthUser {
  id: string
  schoolId: string
  schoolName: string
  role: string
  firstName: string
  lastName: string
  email?: string | null
}

/**
 * Require an authenticated session in a server component or action.
 * Redirects to /login if unauthenticated. Returns the typed user.
 *
 * Usage:
 *   const user = await requireAuth()
 *   const user = await requireAuth('PLATFORM_ADMIN')        // single role
 *   const user = await requireAuth(['SCHOOL_ADMIN', 'SLT']) // multiple roles
 *
 * When `allowedRoles` is provided and the user's role doesn't match,
 * the function redirects to the caller-supplied `fallback` path
 * (default: '/dashboard').
 */
export async function requireAuth(
  allowedRoles?: string | string[],
  fallback = '/dashboard',
): Promise<AuthUser> {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as AuthUser

  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
    if (!roles.includes(user.role)) redirect(fallback)
  }

  return user
}
