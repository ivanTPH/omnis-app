import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LessonPageView from './LessonPageView'

export default async function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { role, firstName, lastName, schoolName } = session.user as any

  const { id } = await params

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <LessonPageView lessonId={id} />
    </AppShell>
  )
}
