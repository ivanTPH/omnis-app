import NextAuth, { type Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkLoginRatelimit } from '@/lib/kv'

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        // Rate limit by IP: 5 attempts per 15 min (no-ops when Upstash not configured)
        const ip = (request as Request | undefined)?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        const { success } = await checkLoginRatelimit(ip)
        if (!success) return null

        const user = await prisma.user.findUnique({
          where: { email },
          include: { school: true },
        })
        if (!user || !user.isActive) return null
        if (!await bcrypt.compare(password, user.passwordHash)) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          schoolId: user.schoolId,
          schoolName: user.school.name,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as Session['user']
        token.id = u.id
        token.schoolId = u.schoolId
        token.schoolName = u.schoolName
        token.role = u.role
        token.firstName = u.firstName
        token.lastName = u.lastName
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
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 4 * 60 * 60 },
})
