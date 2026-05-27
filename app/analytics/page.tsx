import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import StudentAnalyticsView from '@/components/StudentAnalyticsView'
import { getAnalyticsFilters, getTeacherDefaults } from '@/app/actions/analytics'
import { getGradeCalibrationReport } from '@/app/actions/homework'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; subject?: string; yearGroup?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const showCalibration = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN'].includes(role)

  const [filterOptions, teacherDefaults, params, calibrationReport] = await Promise.all([
    getAnalyticsFilters(),
    getTeacherDefaults(),
    searchParams,
    showCalibration ? getGradeCalibrationReport() : Promise.resolve(undefined),
  ])

  // TEACHER and HEAD_OF_DEPT see only their own classes; SLT/admin/others see all
  const isRestrictedRole = ['TEACHER', 'HEAD_OF_DEPT'].includes(role)

  const initialFilters = (params.classId || params.subject || params.yearGroup)
    ? { classId: params.classId, subject: params.subject, yearGroup: params.yearGroup }
    : undefined

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentAnalyticsView
        filterOptions={filterOptions}
        teacherDefaults={teacherDefaults}
        isRestrictedRole={isRestrictedRole}
        initialFilters={initialFilters}
        calibrationReport={calibrationReport}
      />
    </AppShell>
  )
}
