import type { NextAuthConfig, Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ─── Role → home page mapping ─────────────────────────────────────────────────

function getRoleHome(role: string): string {
  switch (role) {
    case 'STUDENT':        return '/student/dashboard'
    case 'PARENT':         return '/parent/dashboard'
    case 'SENCO':          return '/senco/dashboard'
    case 'SLT':            return '/slt/analytics'
    case 'SCHOOL_ADMIN':       return '/admin/dashboard'
    case 'PLATFORM_ADMIN':     return '/platform-admin/dashboard'
    case 'ACADEMY_ADMIN':      return '/academy/dashboard'
    case 'TEACHING_ASSISTANT': return '/ta/notes'
    case 'HEAD_OF_YEAR':       return '/hoy/dashboard'
    case 'HEAD_OF_DEPT':       return '/hod/dashboard'
    default:                   return '/dashboard'
  }
}

// ─── Role-restricted route prefixes ───────────────────────────────────────────

const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: '/platform-admin',  roles: ['PLATFORM_ADMIN'] },
  { prefix: '/academy',         roles: ['ACADEMY_ADMIN', 'PLATFORM_ADMIN'] },
  { prefix: '/admin/subjects',  roles: ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR'] },
  { prefix: '/admin',           roles: ['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER'] },
  { prefix: '/send-caseload',  roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/send-scorer',    roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/ai-generator',   roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/revision-program', roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/revision',       roles: ['STUDENT'] },
  { prefix: '/parent',         roles: ['PARENT'] },
  { prefix: '/analytics',      roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO', 'TEACHING_ASSISTANT'] },
  { prefix: '/ta',             roles: ['TEACHING_ASSISTANT'] },
  { prefix: '/senco',          roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'] },
  { prefix: '/send',           roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'] },
  { prefix: '/hoy/safeguarding', roles: ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO'] },
  { prefix: '/hoy',            roles: ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/hod',            roles: ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN'] },
  { prefix: '/slt',            roles: ['SLT', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN'] },
  { prefix: '/plans/year-group',   roles: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT'] },
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
    authorized({ auth, request }: { auth: Session | null; request: Request }) {
      const user = auth?.user
      if (!user) {
        const req      = request as unknown as NextRequest
        const pathname = req.nextUrl?.pathname ?? '/'
        if (pathname === '/') {
          const url = req.nextUrl.clone()
          url.pathname = '/marketing/home'
          return NextResponse.redirect(url)
        }
        return false  // unauthenticated → redirect to /login
      }

      // Next.js middleware always provides NextRequest; nextUrl is safe to access.
      const req      = request as unknown as NextRequest
      const pathname = req.nextUrl?.pathname ?? '/dashboard'
      const role     = user.role as string

      // DPA gate — staff must acknowledge data processing agreement on first access
      const STAFF_ROLES = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN',
                           'TEACHING_ASSISTANT','COVER_MANAGER','PLATFORM_ADMIN','ACADEMY_ADMIN','SUPER_ADMIN']
      if (STAFF_ROLES.includes(role) && !(auth as any)?.user?.dpaAcceptedAt && pathname !== '/accept-dpa') {
        const url = req.nextUrl.clone()
        url.pathname = '/accept-dpa'
        return NextResponse.redirect(url)
      }

      // Check role-based route restrictions
      for (const { prefix, roles } of ROLE_ROUTES) {
        if (pathname.startsWith(prefix)) {
          if (!roles.includes(role)) {
            // Redirect wrong-role users to their own home page (not /login)
            const home = getRoleHome(role)
            const url  = req.nextUrl.clone()
            url.pathname = home
            return NextResponse.redirect(url)
          }
          break
        }
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        // user is present only on sign-in; custom fields come from authorize()
        const u = user as Session['user']
        token.id = u.id
        token.schoolId = u.schoolId
        token.schoolName = u.schoolName
        token.role = u.role
        token.firstName = u.firstName
        token.lastName = u.lastName
        token.dpaAcceptedAt = (u as any).dpaAcceptedAt ?? null
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user.id = token.id
      session.user.schoolId = token.schoolId
      session.user.schoolName = token.schoolName
      session.user.role = token.role
      session.user.firstName = token.firstName
      session.user.lastName = token.lastName
      ;(session.user as any).dpaAcceptedAt = token.dpaAcceptedAt
      return session
    },
  },
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' },
} satisfies NextAuthConfig
