import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSencoDashboardData } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import SencoDashboard from '@/components/send-support/SencoDashboard'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function SencoDashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getSencoDashboardData()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader title="SEND Overview" subtitle="Students with identified needs" />
        </div>
        <SencoDashboard data={data} />
      </div>
    </AppShell>
  )
}
