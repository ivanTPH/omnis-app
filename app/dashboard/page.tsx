import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import DashboardMorningView from '@/components/DashboardMorningView'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <DashboardMorningView firstName={firstName} role={role} />
    </AppShell>
  )
}
