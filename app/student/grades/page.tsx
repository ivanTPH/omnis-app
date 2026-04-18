import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StudentGradesView from '@/components/student/StudentGradesView'
import { getStudentGradeHistory } from '@/app/actions/student'

export default async function StudentGradesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const subjectSummaries = await getStudentGradeHistory()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentGradesView summaries={subjectSummaries} />
    </AppShell>
  )
}
