import NextAuth, { type Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkLoginRatelimit, mfaInfraAvailable, verifyAndConsumeMfaCode } from '@/lib/kv'
import { STAFF_ROLES } from '@/lib/roles'

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
        otpCode: { type: 'text' }, // staff-only second factor; see app/actions/mfa.ts
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        const otpCode = credentials?.otpCode as string | undefined
        if (!email || !password) return null

        // Rate limit by IP: 5 attempts per 15 min (no-ops when Upstash not configured)
        const req = request as Request | undefined
        const ip  = req?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
               ??  req?.headers?.get('x-real-ip')
               ??  'unknown'
        const { success } = await checkLoginRatelimit(ip)
        if (!success) return null

        const user = await prisma.user.findUnique({
          where: { email },
          include: { school: true },
        })
        if (!user || !user.isActive) return null
        if (!await bcrypt.compare(password, user.passwordHash)) return null

        // MFA: staff roles must supply a valid, single-use email code once
        // Upstash is configured. Gracefully skipped when MFA infra is
        // unavailable (dev/CI), matching the rate-limiter convention above.
        if ((STAFF_ROLES as readonly string[]).includes(user.role) && mfaInfraAvailable()) {
          if (!otpCode || !(await verifyAndConsumeMfaCode(user.id, otpCode))) return null
        }

        // Set activatedAt on first ever login (fire-and-forget)
        if (!user.activatedAt) {
          void prisma.user.update({ where: { id: user.id }, data: { activatedAt: new Date() } })
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          schoolId: user.schoolId,
          schoolName: user.school.name,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          dpaAcceptedAt:   user.dpaAcceptedAt?.toISOString()   ?? null,
          termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update') {
        if (session?.dpaAcceptedAt)   token.dpaAcceptedAt   = session.dpaAcceptedAt
        if (session?.termsAcceptedAt) token.termsAcceptedAt = session.termsAcceptedAt
      }
      if (user) {
        const u = user as Session['user']
        token.id = u.id
        token.schoolId = u.schoolId
        token.schoolName = u.schoolName
        token.role = u.role
        token.firstName = u.firstName
        token.lastName = u.lastName
        token.dpaAcceptedAt   = (u as any).dpaAcceptedAt   ?? null
        token.termsAcceptedAt = (u as any).termsAcceptedAt ?? null
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.schoolId = token.schoolId
      session.user.schoolName = token.schoolName
      session.user.role = token.role
      session.user.firstName = token.firstName
      session.user.lastName = token.lastName
      ;(session.user as any).dpaAcceptedAt   = token.dpaAcceptedAt
      ;(session.user as any).termsAcceptedAt = token.termsAcceptedAt
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 4 * 60 * 60 },
})
