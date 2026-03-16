import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import HomeworkMarkingView from '@/components/HomeworkMarkingView'
import { getHomeworkForMarking } from '@/app/actions/homework'

export default async function HomeworkMarkingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const { id } = await params
  const hw = await getHomeworkForMarking(id)
  if (!hw) notFound()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <HomeworkMarkingView hw={hw} />
      </div>
    </AppShell>
  )
}
