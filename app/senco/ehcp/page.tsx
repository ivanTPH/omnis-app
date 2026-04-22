import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllEhcpPlans, getStudentsWithSendButNoEhcp } from '@/app/actions/ehcp'
import AppShell from '@/components/AppShell'
import EhcpPageClient from '@/components/send-support/EhcpPageClient'

export default async function EhcpPlansPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)

  const [plans, studentsWithoutEhcp] = await Promise.all([
    getAllEhcpPlans(),
    isSenco ? getStudentsWithSendButNoEhcp() : Promise.resolve([]),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <h1 className="text-xl font-semibold text-gray-900">EHCP Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Education, Health and Care Plans — outcome tracking and annual review</p>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          <EhcpPageClient plans={plans} studentsWithoutEhcp={studentsWithoutEhcp} isSenco={isSenco} />
        </div>
      </div>
    </AppShell>
  )
}
