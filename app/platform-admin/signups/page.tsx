import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getSignupDashboard } from '@/app/actions/signups'
import SignupsDashboard from './SignupsDashboard'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Beta Signups — Omnis' }

export default async function SignupsPage() {
  const user = await requireAuth('PLATFORM_ADMIN')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } })
  if (dbUser?.email !== 'ivanyardley@me.com') redirect('/platform-admin/dashboard')

  const data = await getSignupDashboard()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <SignupsDashboard data={data} />
    </AppShell>
  )
}
