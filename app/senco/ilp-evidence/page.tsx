import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getIlpEvidenceStudents } from '@/app/actions/adaptive-learning'
import AppShell from '@/components/AppShell'
import IlpEvidenceView from '@/components/send-support/IlpEvidenceView'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function IlpEvidencePage() {
  const user = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const data = await getIlpEvidenceStudents()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader title="ILP Evidence" subtitle="Track homework evidence linked to ILP targets" />
        </div>
        <div className="px-6 pb-6">
          <IlpEvidenceView data={data} />
        </div>
      </div>
    </AppShell>
  )
}
