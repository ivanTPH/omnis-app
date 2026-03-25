import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdaptiveAnalyticsDashboard from '@/components/analytics/AdaptiveAnalyticsDashboard'

export default async function AdaptiveAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <AdaptiveAnalyticsDashboard />
    </div>
  )
}
