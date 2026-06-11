import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAuth } from '@/lib/session'
import { getAcademySchools, getAcademyStats } from '@/app/actions/academy'
import Icon from '@/components/ui/Icon'
import Link from 'next/link'
import PrintButton from '@/components/ui/PrintButton'

export default async function AcademyReportsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(role)) redirect('/dashboard')

  const [stats, schools] = await Promise.all([getAcademyStats(), getAcademySchools()])

  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const pendingOnboarding = schools.filter(s => !s.onboardedAt).length
  const staleSyncSchools  = schools.filter(s => s.lastSync &&
    Date.now() - new Date(s.lastSync).getTime() > 14 * 86_400_000).length
  const noSyncSchools     = schools.filter(s => !s.lastSync).length

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">
          <PageHeader
            title="Trust Reports"
            subtitle={`Summary as of ${now}`}
            backHref="/academy/dashboard"
            backLabel="Academy Dashboard"
            action={
              <div className="flex items-center gap-2">
                <Link
                  href="/api/export/academy-report"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  <Icon name="picture_as_pdf" size="sm" />
                  Export PDF
                </Link>
                <PrintButton />
              </div>
            }
          />

          {/* Compliance summary */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Icon name="verified" size="sm" className="text-blue-600" />
              <h2 className="text-[13px] font-semibold text-gray-700">Compliance & Setup</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <ReportRow
                label="Schools onboarded"
                value={`${stats.onboardedSchools} / ${stats.totalSchools}`}
                status={pendingOnboarding === 0 ? 'good' : pendingOnboarding <= 1 ? 'amber' : 'red'}
                detail={pendingOnboarding > 0 ? `${pendingOnboarding} pending setup` : 'All complete'}
              />
              <ReportRow
                label="MIS sync up to date (≤14 days)"
                value={`${stats.totalSchools - staleSyncSchools - noSyncSchools} / ${stats.totalSchools}`}
                status={staleSyncSchools + noSyncSchools === 0 ? 'good' : 'amber'}
                detail={noSyncSchools > 0 ? `${noSyncSchools} never synced` : staleSyncSchools > 0 ? `${staleSyncSchools} overdue` : 'All current'}
              />
            </div>
          </section>

          {/* SEND summary */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Icon name="favorite" size="sm" className="text-purple-600" />
              <h2 className="text-[13px] font-semibold text-gray-700">SEND Summary</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <ReportRow label="Active ILPs"    value={stats.totalActiveIlps.toString()} status="info" />
              <ReportRow label="EHCP Plans"     value={stats.totalEhcps.toString()}       status="info" />
              <ReportRow
                label="Open SEND Concerns"
                value={stats.openConcerns.toString()}
                status={stats.openConcerns === 0 ? 'good' : stats.openConcerns < 10 ? 'amber' : 'red'}
                detail={stats.openConcerns > 0 ? 'Requires review across trust' : 'No open concerns'}
              />
            </div>
          </section>

          {/* Scale summary */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Icon name="people" size="sm" className="text-blue-600" />
              <h2 className="text-[13px] font-semibold text-gray-700">Scale</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <ReportRow label="Total schools"  value={stats.totalSchools.toLocaleString()}  status="info" />
              <ReportRow label="Total students" value={stats.totalStudents.toLocaleString()} status="info" />
              <ReportRow label="Total staff"    value={stats.totalStaff.toLocaleString()}    status="info" />
            </div>
          </section>

          <p className="text-[11px] text-gray-400 text-center">
            Data is live from the Omnis platform.
          </p>
        </div>
      </main>
    </AppShell>
  )
}

function ReportRow({
  label, value, status, detail,
}: {
  label:   string
  value:   string
  status:  'good' | 'amber' | 'red' | 'info'
  detail?: string
}) {
  const dot = {
    good:  'bg-green-500',
    amber: 'bg-amber-400',
    red:   'bg-red-500',
    info:  'bg-blue-400',
  }[status]

  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <div>
          <p className="text-[13px] text-gray-700">{label}</p>
          {detail && <p className="text-[11px] text-gray-400 mt-0.5">{detail}</p>}
        </div>
      </div>
      <p className="text-[15px] font-bold text-gray-900">{value}</p>
    </div>
  )
}
