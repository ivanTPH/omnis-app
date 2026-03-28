import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getStudentFile } from '@/app/actions/students'
import StudentFilePanel from '@/components/students/StudentFilePanel'

export default async function StudentFilePage({ params }: { params: { studentId: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN']
  const role = (session.user as { role: string }).role
  if (!allowed.includes(role)) redirect('/dashboard')

  const data = await getStudentFile(params.studentId)
  if (!data) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentFilePanel data={data} role={role} />
    </div>
  )
}
