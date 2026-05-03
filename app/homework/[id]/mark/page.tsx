import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import HomeworkMarkingV2 from '@/components/HomeworkMarkingV2'
import { getHomeworkForMarking } from '@/app/actions/homework'

export default async function HomeworkMarkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const canGrade = ['TEACHER', 'HEAD_OF_DEPT'].includes(role)

  const { id } = await params
  const hw = await getHomeworkForMarking(id)
  if (!hw) notFound()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <HomeworkMarkingV2 hw={hw as any} canGrade={canGrade} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
    </AppShell>
  )
}
