import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StudentAnalyticsView from '@/components/StudentAnalyticsView'
import { getAnalyticsFilters } from '@/app/actions/analytics'

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any

  const filterOptions = await getAnalyticsFilters()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentAnalyticsView filterOptions={filterOptions} />
    </AppShell>
  )
}
