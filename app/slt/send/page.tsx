import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'
import Link from 'next/link'
import { getSltSendDashboard } from '@/app/actions/slt-send'
import SltSendDashboard from '@/components/slt/SltSendDashboard'

export const dynamic = 'force-dynamic'

export default async function SltSendPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN', 'SENCO'].includes(role)) redirect('/dashboard')

  const data = await getSltSendDashboard()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/slt/analytics" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Icon name="chevron_left" size="sm" /> Analytics
                </Link>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900">SEND Reporting Dashboard</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{schoolName} — SLT overview of Special Educational Needs provision</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                DfE SEND CoP 2015
              </span>
            </div>
          </div>

          <SltSendDashboard data={data} />

        </div>
      </main>
    </AppShell>
  )
}
