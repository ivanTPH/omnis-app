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
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Adaptive Learning Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Homework type performance, Bloom&apos;s taxonomy distribution, and ILP/EHCP evidence coverage across your school.
        </p>
      </div>
      <AdaptiveAnalyticsDashboard />
    </div>
  )
}
