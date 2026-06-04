import { requireAuth }                      from '@/lib/session'
import { redirect }                         from 'next/navigation'
import AppShell                             from '@/components/AppShell'
import AgentRecommendationsView             from '@/components/senco/AgentRecommendationsView'
import { getPendingAgentRecommendations }   from '@/app/actions/agent-insights'

export default async function SencoAgentInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const sp     = await searchParams
  const filter = (sp.filter === 'reviewed' || sp.filter === 'all') ? sp.filter : 'pending'
  const page   = Math.max(0, parseInt(sp.page ?? '0', 10) || 0)

  const { items, total } = await getPendingAgentRecommendations(filter, page, 30)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <AgentRecommendationsView items={items} total={total} filter={filter} page={page} />
    </AppShell>
  )
}
