import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSencoDashboardData } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import SencoDashboard from '@/components/send-support/SencoDashboard'

export default async function SencoDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getSencoDashboardData()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <h1 className="text-xl font-semibold text-gray-900">SEND Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Proactive monitoring, concerns and ILP management</p>
        </div>
        <SencoDashboard data={data} />
      </div>
    </AppShell>
  )
}
