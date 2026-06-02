import { requireAuth }           from '@/lib/session'
import { redirect }               from 'next/navigation'
import AppShell                   from '@/components/AppShell'
import PageHeader                 from '@/components/ui/PageHeader'
import { getPopulationInsights }  from '@/app/actions/population'
import PopulationDashboard        from '@/components/slt/PopulationDashboard'

export const dynamic = 'force-dynamic'

export default async function PopulationPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getPopulationInsights()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Population Insights"
          subtitle={`${schoolName} — cohort-level analysis`}
        />
        <PopulationDashboard data={data} />
      </div>
    </AppShell>
  )
}
