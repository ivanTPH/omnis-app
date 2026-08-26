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
  searchParams: Promise<{ lessonId?: string; returnTab?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth(['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN'])

  const { studentId } = await params
  const { lessonId, returnTab } = await searchParams
  const data = await getStudentFile(studentId)
  if (!data) redirect('/dashboard')

  // When we arrived here from a lesson's Class / SEND & Inclusion tab, send
  // the teacher straight back to that lesson — and that same tab — rather
  // than to the dashboard.
  const backHref = lessonId
    ? `/lessons/${lessonId}${returnTab ? `?tab=${encodeURIComponent(returnTab)}` : ''}`
    : undefined

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 overflow-y-auto min-h-0">
        <StudentFilePanel data={data} role={role} backHref={backHref} />
      </div>
    </AppShell>
  )
}
