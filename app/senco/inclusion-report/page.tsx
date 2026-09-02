import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import InclusionReportView from '@/components/senco/InclusionReportView'

export const dynamic = 'force-dynamic'

export default async function InclusionReportPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_YEAR'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <PageHeader
            title="Inclusion evidence summary"
            subtitle="SEND provision evidence — register, ILP/EHCP coverage, evidence-backed progress, and parent/pupil voice, ready to filter and export."
            backHref="/dashboard"
            backLabel="Dashboard"
          />
          <InclusionReportView />
        </div>
      </main>
    </AppShell>
  )
}
