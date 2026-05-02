import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getIlpEvidenceStudents } from '@/app/actions/adaptive-learning'
import AppShell from '@/components/AppShell'
import IlpEvidenceView from '@/components/send-support/IlpEvidenceView'

export default async function IlpEvidencePage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { schoolId: string; role: string; firstName: string; lastName: string; schoolName: string }
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const data = await getIlpEvidenceStudents()

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-page-title">ILP Evidence</h1>
          <p className="text-sm text-gray-500 mt-1">Track homework evidence linked to Individual Learning Plan targets</p>
        </div>
        <IlpEvidenceView data={data} />
      </div>
    </AppShell>
  )
}
