import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import AdaptiveAnalyticsDashboard from '@/components/analytics/AdaptiveAnalyticsDashboard'

export default async function AdaptiveAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <AdaptiveAnalyticsDashboard />
    </AppShell>
  )
}
