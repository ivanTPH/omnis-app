import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getStudentFile } from '@/app/actions/students'
import StudentFilePanel from '@/components/students/StudentFilePanel'
import AppShell from '@/components/AppShell'

export default async function StudentFilePage({ params }: { params: { studentId: string } }) {
  const { role, firstName, lastName, schoolName } = await requireAuth(['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN'])

  const data = await getStudentFile(params.studentId)
  if (!data) redirect('/dashboard')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 overflow-y-auto min-h-0">
        <StudentFilePanel data={data} role={role} />
      </div>
    </AppShell>
  )
}
