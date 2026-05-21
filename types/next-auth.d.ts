import type { Role } from '@prisma/client'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      schoolId: string
      schoolName: string
      role: Role
      firstName: string
      lastName: string
    }
  }

  // Extends the User object returned by authorize() so JWT callback is typed.
  interface User {
    schoolId: string
    schoolName: string
    role: Role
    firstName: string
    lastName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    schoolId: string
    schoolName: string
    role: Role
    firstName: string
    lastName: string
  }
}
