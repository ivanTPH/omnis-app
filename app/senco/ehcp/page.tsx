import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAllEhcpPlans, getStudentsWithSendButNoEhcp } from '@/app/actions/ehcp'
import AppShell from '@/components/AppShell'
import EhcpPageClient from '@/components/send-support/EhcpPageClient'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function EhcpPlansPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')
  const isSenco = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)

  const [plans, studentsWithoutEhcp] = await Promise.all([
    getAllEhcpPlans(),
    isSenco ? getStudentsWithSendButNoEhcp() : Promise.resolve([]),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader title="EHCP Plans" subtitle="Education, Health and Care Plans — outcome tracking" />
        </div>
        <div className="px-6 pb-6 w-full">
          <EhcpPageClient plans={plans} studentsWithoutEhcp={studentsWithoutEhcp} isSenco={isSenco} />
        </div>
      </div>
    </AppShell>
  )
}
