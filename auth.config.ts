import type { NextAuthConfig } from 'next-auth'

// Lightweight config used only by middleware (Edge runtime).
// No Prisma or bcrypt imports — those stay in lib/auth.ts.
export const authConfig = {
  secret:    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],   // credentials provider not needed — middleware only verifies JWT
  callbacks: {
    authorized({ auth }: any) {
      return !!auth?.user   // unauthenticated → redirect to /login
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
