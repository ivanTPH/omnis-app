import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getStudentFile } from '@/app/actions/students'
import StudentFilePanel from '@/components/students/StudentFilePanel'
import AppShell from '@/components/AppShell'

export default async function StudentFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ lessonId?: string; returnTab?: string; origin?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth(['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN'])

  const { studentId } = await params
  const { lessonId, returnTab, origin } = await searchParams
  const data = await getStudentFile(studentId)
  if (!data) redirect('/dashboard')

  // When we arrived here from a lesson's Class / SEND & Inclusion tab, send
  // the teacher straight back to that lesson — and that same tab — rather
  // than to the dashboard. If the lesson was open as a calendar drawer
  // (origin=drawer) rather than the full /lessons/[id] page, route back to
  // the calendar so it can reopen its own drawer in the same spot, instead
  // of always landing on the full-page view.
  const backHref = lessonId
    ? origin === 'drawer'
      ? `/calendar?openLesson=${lessonId}${returnTab ? `&tab=${encodeURIComponent(returnTab)}` : ''}`
      : `/lessons/${lessonId}${returnTab ? `?tab=${encodeURIComponent(returnTab)}` : ''}`
    : undefined

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 overflow-y-auto min-h-0">
        <StudentFilePanel data={data} role={role} backHref={backHref} />
      </div>
    </AppShell>
  )
}
