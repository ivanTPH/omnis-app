import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StudentGradesView from '@/components/student/StudentGradesView'
import { getStudentGradeHistory, getMyParentShareStatus } from '@/app/actions/student'

export default async function StudentGradesPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'STUDENT') redirect('/dashboard')

  const [subjectSummaries, shareStatus] = await Promise.all([
    getStudentGradeHistory(),
    getMyParentShareStatus(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentGradesView summaries={subjectSummaries} hasLinkedParent={shareStatus.hasLinkedParent} />
    </AppShell>
  )
}
