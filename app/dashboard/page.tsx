import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import DashboardMorningView from '@/components/DashboardMorningView'

export default async function DashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <DashboardMorningView firstName={firstName} role={role} />
    </AppShell>
  )
}
