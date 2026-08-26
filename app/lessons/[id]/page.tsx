import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import LessonPageView from './LessonPageView'

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const { id } = await params
  const { tab } = await searchParams

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <LessonPageView lessonId={id} defaultTab={tab} />
    </AppShell>
  )
}
