import { requireAuth }           from '@/lib/session'
import { redirect }               from 'next/navigation'
import { getStudentTimetable }    from '@/app/actions/students'
import StudentTimetableView       from '@/components/student/StudentTimetableView'
import AppShell                   from '@/components/AppShell'

export default async function StudentTimetablePage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'STUDENT') redirect('/dashboard')

  const timetable = await getStudentTimetable()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentTimetableView timetable={timetable} />
    </AppShell>
  )
}
