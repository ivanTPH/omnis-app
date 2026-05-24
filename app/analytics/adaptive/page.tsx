import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import AdaptiveAnalyticsDashboard from '@/components/analytics/AdaptiveAnalyticsDashboard'

export default async function AdaptiveAnalyticsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <AdaptiveAnalyticsDashboard />
    </AppShell>
  )
}
