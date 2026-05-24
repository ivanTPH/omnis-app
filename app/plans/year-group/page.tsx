import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import YearGroupPlansView from '@/components/plans/YearGroupPlansView'
import { getYearGroupPlans } from '@/app/actions/year-group-plans'

export default async function YearGroupPlansPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  const allowed = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT']
  if (!allowed.includes(role)) redirect('/dashboard')

  const plans = await getYearGroupPlans()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <YearGroupPlansView plans={plans} userRole={role} />
    </AppShell>
  )
}
