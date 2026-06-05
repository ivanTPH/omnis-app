import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import { getSubjectConfigs } from '@/app/actions/admin'
import SubjectConfigPanel from '@/components/admin/SubjectConfigPanel'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

export default async function AdminSubjectsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const configs = await getSubjectConfigs()
  const canEdit = ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR'].includes(role)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-gray-900">Subjects &amp; Exam Boards</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Set the default exam board for each subject. These defaults apply to classes that have no exam board set, and are used in AI homework generation and marking.
          </p>
        </div>
        <SubjectConfigPanel configs={configs} canEdit={canEdit} role={role} />
      </div>
    </AppShell>
  )
}
