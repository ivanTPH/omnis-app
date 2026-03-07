import { auth }           from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell           from '@/components/AppShell'
import StudentDashboard   from '@/components/StudentDashboard'
import { getStudentDetail } from '@/app/actions/analytics'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const { id } = await params
  const data = await getStudentDetail(id)
  if (!data) notFound()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto">
        <StudentDashboard data={data} />
      </main>
    </AppShell>
  )
}
