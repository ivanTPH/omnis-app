import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getRoleHome } from '@/auth.config'

export default async function RootPage() {
  const user = await requireAuth()
  // The owner's PLATFORM_ADMIN account goes to the demo role picker; every
  // other role uses the same home as the sign-in redirect in auth.config.ts,
  // so the two can never disagree (Heads of Department used to fall through
  // to the teacher /dashboard here).
  if (user.role === 'PLATFORM_ADMIN') {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } })
    if (dbUser?.email === 'ivanyardley@me.com') redirect('/demo')
  }
  redirect(getRoleHome(user.role))
}
