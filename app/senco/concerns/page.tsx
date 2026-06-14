import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getAllConcerns, getSchoolStaff, getFollowUpDueConcerns } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import ConcernsPageView from '@/components/send-support/ConcernsPageView'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function ConcernsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
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
          <PageHeader
            title="SEND Concerns"
            subtitle="All concerns raised across the school"
            action={
              <Link
                href="/api/export/send-caseload"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="download" size="sm" />
                SEND Caseload CSV
              </Link>
            }
          />
        </div>
        <div className="px-6 pb-6">
          <ConcernsPageView initialConcerns={concerns} staffList={staffList} followUpDue={followUpDue} />
        </div>
      </div>
    </AppShell>
  )
}
