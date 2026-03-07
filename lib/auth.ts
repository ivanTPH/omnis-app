import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [CredentialsProvider({ name: 'credentials', credentials: { email: { type: 'email' }, password: { type: 'password' } },
    async authorize(c: any) {
      if (!c?.email || !c?.password) return null
      const user = await prisma.user.findUnique({ where: { email: c.email }, include: { school: true } })
      if (!user || !user.isActive) return null
      if (!await bcrypt.compare(c.password, user.passwordHash)) return null
      return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`, schoolId: user.schoolId, schoolName: user.school.name, role: user.role, firstName: user.firstName, lastName: user.lastName }
    }
  })],
  callbacks: {
    async jwt({ token, user }: any) { if (user) Object.assign(token, { id: user.id, schoolId: user.schoolId, schoolName: user.schoolName, role: user.role, firstName: user.firstName, lastName: user.lastName }); return token },
    async session({ session, token }: any) { Object.assign(session.user, { id: token.id, schoolId: token.schoolId, schoolName: token.schoolName, role: token.role, firstName: token.firstName, lastName: token.lastName }); return session },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
