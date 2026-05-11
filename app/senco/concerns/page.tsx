import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllConcerns, getSchoolStaff, getFollowUpDueConcerns } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import ConcernsPageView from '@/components/send-support/ConcernsPageView'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function ConcernsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT'].includes(role)) redirect('/dashboard')

  const [concerns, staffList, followUpDue] = await Promise.all([
    getAllConcerns(),
    getSchoolStaff(),
    getFollowUpDueConcerns(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader title="SEND Concerns" subtitle="All concerns raised across the school" />
        </div>
        <div className="px-6 pb-6">
          <ConcernsPageView initialConcerns={concerns} staffList={staffList} followUpDue={followUpDue} />
        </div>
      </div>
    </AppShell>
  )
}
