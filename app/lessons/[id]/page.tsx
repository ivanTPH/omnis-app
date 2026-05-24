import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import LessonPageView from './LessonPageView'

export default async function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const { id } = await params

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <LessonPageView lessonId={id} />
    </AppShell>
  )
}
