import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSencoDashboardData } from '@/app/actions/send-support'
import AppShell from '@/components/AppShell'
import SencoDashboard from '@/components/send-support/SencoDashboard'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default async function SencoDashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getSencoDashboardData()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-6 bg-white shrink-0">
          <PageHeader
            title="SEND Overview"
            subtitle="Students with identified needs"
            action={
              <div className="flex items-center gap-2">
                <Link
                  href="/api/export/intervention-register"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <Icon name="download" size="sm" />
                  Intervention Register
                </Link>
                <Link
                  href="/api/export/apdr-batch"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <Icon name="download" size="sm" />
                  APDR CSV
                </Link>
                <Link
                  href="/api/export/ta-notes"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <Icon name="download" size="sm" />
                  TA Notes CSV
                </Link>
              </div>
            }
          />
        </div>
        <SencoDashboard data={data} />
      </div>
    </AppShell>
  )
}
