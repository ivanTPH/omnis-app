import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

// ─── Role → home page mapping ─────────────────────────────────────────────────

function getRoleHome(role: string): string {
  switch (role) {
    case 'STUDENT':        return '/student/dashboard'
    case 'PARENT':         return '/parent/dashboard'
    case 'SENCO':          return '/send/dashboard'
    case 'SLT':            return '/slt/analytics'
    case 'SCHOOL_ADMIN':   return '/admin/dashboard'
    case 'PLATFORM_ADMIN': return '/platform-admin/dashboard'
    default:               return '/dashboard'
  }
}

// ─── Role-restricted route prefixes ───────────────────────────────────────────

const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: '/platform-admin', roles: ['PLATFORM_ADMIN'] },
  { prefix: '/admin',          roles: ['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER'] },
  { prefix: '/send-scorer',    roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/ai-generator',   roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/revision-program', roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/revision',       roles: ['STUDENT'] },
  { prefix: '/parent',         roles: ['PARENT'] },
  { prefix: '/analytics',      roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO'] },
  { prefix: '/senco',          roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'] },
  { prefix: '/send',           roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'] },
  { prefix: '/hoy',            roles: ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/slt',            roles: ['SLT', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN'] },
  { prefix: '/student/dashboard',  roles: ['STUDENT'] },
  { prefix: '/student/homework',   roles: ['STUDENT'] },
  { prefix: '/student/grades',     roles: ['STUDENT'] },
  { prefix: '/student/revision',   roles: ['STUDENT'] },
]

// Lightweight config used only by middleware (Edge runtime).
// No Prisma or bcrypt imports — those stay in lib/auth.ts.
export const authConfig = {
  secret:    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],   // credentials provider not needed — middleware only verifies JWT
  callbacks: {
    authorized({ auth, request }: any) {
      const user = auth?.user
      if (!user) return false  // unauthenticated → redirect to /login

      const pathname = (request as any).nextUrl?.pathname as string ?? '/'
      const role     = user.role as string

      // Check role-based route restrictions
      for (const { prefix, roles } of ROLE_ROUTES) {
        if (pathname.startsWith(prefix)) {
          if (!roles.includes(role)) {
            // Redirect wrong-role users to their own home page (not /login)
            const home = getRoleHome(role)
            const url  = (request as any).nextUrl.clone()
            url.pathname = home
            return NextResponse.redirect(url)
          }
          break
        }
      }

      return true
    },
    async jwt({ token, user }: any) {
      if (user) Object.assign(token, {
        id: user.id, schoolId: user.schoolId, schoolName: user.schoolName,
        role: user.role, firstName: user.firstName, lastName: user.lastName,
      })
      return token
    },
    async session({ session, token }: any) {
      Object.assign(session.user, {
        id: token.id, schoolId: token.schoolId, schoolName: token.schoolName,
        role: token.role, firstName: token.firstName, lastName: token.lastName,
      })
      return session
    },
  },
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' },
} satisfies NextAuthConfig
