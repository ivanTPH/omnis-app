import { requireAuth }           from '@/lib/session'
import { redirect }               from 'next/navigation'
import { getTeacherTimetable }    from '@/app/actions/dashboard'
import TeacherTimetableView       from '@/components/teacher/TeacherTimetableView'
import AppShell                   from '@/components/AppShell'

const ALLOWED_ROLES = new Set(['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'])

export default async function TeacherTimetablePage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED_ROLES.has(role)) redirect('/dashboard')

  const timetable = await getTeacherTimetable()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <TeacherTimetableView timetable={timetable} />
    </AppShell>
  )
}
