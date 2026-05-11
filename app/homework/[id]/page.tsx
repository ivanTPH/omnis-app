import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import HomeworkMarkingView from '@/components/HomeworkMarkingView'
import { getHomeworkForMarking } from '@/app/actions/homework'
import { getYearGroupPlanContext } from '@/app/actions/year-group-plans'

export default async function HomeworkMarkingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName, schoolId } = session.user as any
  const canGrade = ['TEACHER', 'HEAD_OF_DEPT'].includes(role)

  const { id } = await params
  const hw = await getHomeworkForMarking(id)
  if (!hw) notFound()

  const subject   = hw.class?.subject ?? ''
  const yearGroup = hw.class?.yearGroup ?? 0
  const yearPlan  = subject && yearGroup
    ? await getYearGroupPlanContext(schoolId, subject, yearGroup)
    : null

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <HomeworkMarkingView hw={hw} canGrade={canGrade} yearPlan={yearPlan} />
      </div>
    </AppShell>
  )
}
