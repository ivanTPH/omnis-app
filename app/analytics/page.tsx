import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StudentAnalyticsView from '@/components/StudentAnalyticsView'
import { getAnalyticsFilters, getTeacherDefaults } from '@/app/actions/analytics'

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const [filterOptions, teacherDefaults] = await Promise.all([
    getAnalyticsFilters(),
    getTeacherDefaults(),
  ])

  // TEACHER and HEAD_OF_DEPT see only their own classes; SLT/admin/others see all
  const isRestrictedRole = ['TEACHER', 'HEAD_OF_DEPT'].includes(role)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentAnalyticsView
        filterOptions={filterOptions}
        teacherDefaults={teacherDefaults}
        isRestrictedRole={isRestrictedRole}
      />
    </AppShell>
  )
}
